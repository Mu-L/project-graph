import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { useAtom } from "jotai";
import {
  Delete,
  Eye,
  EyeClosed,
  FileClock,
  FilePlus2,
  FolderTree,
  HardDriveDownload,
  Pin,
  PinOff,
  RefreshCw,
  Trash2,
} from "lucide-react";
import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Dialog } from "../../components/dialog";
import IconButton from "../../components/IconButton";
import Switch from "../../components/Switch";
import { FileLoader } from "../../core/service/dataFileService/fileLoader";
import { StageSaveManager } from "../../core/service/dataFileService/StageSaveManager";
import { StartFilesManager } from "../../core/service/dataFileService/StartFilesManager";
import { StageManager } from "../../core/stage/stageManager/StageManager";
import { cn } from "../../utils/cn";
import { PathString } from "../../utils/pathString";
import { isDesktop } from "../../utils/platform";

export default function StartFilePanel({ open = false }: { open: boolean }) {
  const [startFiles, setStartFiles] = React.useState<StartFilesManager.StartFile[]>([]);
  const { t } = useTranslation("startFilePanel");

  const [currentStartFile, setCurrentStartFile] = React.useState<string>("");
  const [currentFile, setFile] = useAtom(fileAtom);
  const [isShowAbsolutePath, setIsShowAbsolutePath] = React.useState(false);
  const [isShowTime, setIsShowTime] = React.useState(false);
  const [isPanelTransparent, setIsPanelTransparent] = React.useState(false);

  useEffect(() => {
    updateStartFiles();
  }, []);

  const updateStartFiles = async () => {
    await StartFilesManager.validateAndRefreshStartFiles();
    const files = await StartFilesManager.getStartFiles();
    const current = await StartFilesManager.getCurrentStartFile();
    setCurrentStartFile(current);
    setStartFiles(files);
  };
  const onClearList = async () => {
    const clearSuccess = await StartFilesManager.clearStartFiles();
    if (clearSuccess) {
      Dialog.show({
        title: "清空成功",
        content: "已清空启动文件列表",
        type: "success",
      });
      updateStartFiles();
    } else {
      Dialog.show({
        title: "清空失败",
        content: "启动文件列表为空",
        type: "error",
      });
    }
  };
  const onAddFile = async () => {
    const path = await openFileDialog({
      title: "打开文件",
      directory: false,
      multiple: false,
      filters: isDesktop
        ? [
            {
              name: "Project Graph",
              extensions: ["json"],
            },
          ]
        : [],
    });
    if (!path) {
      return;
    }
    if (isDesktop && !path.endsWith(".json")) {
      Dialog.show({
        title: "请选择一个JSON文件",
        type: "error",
      });
      return;
    }
    try {
      const addSuccess = await StartFilesManager.addStartFile(path);
      if (!addSuccess) {
        Dialog.show({
          title: "文件添加失败",
          content: `可能是重复了：${path}`,
          type: "error",
        });
      }
      updateStartFiles();
    } catch (e) {
      Dialog.show({
        title: "请选择正确的JSON文件",
        content: String(e),
        type: "error",
      });
    }
  };
  const onSetCurrentStartFile = (path: string) => {
    return function () {
      StartFilesManager.setCurrentStartFile(path).then((res) => {
        if (res) {
          setCurrentStartFile(path);
        } else {
          Dialog.show({
            title: "文件切换失败",
            content: `文件不存在：${path}`,
            type: "error",
          });
        }
      });
    };
  };
  const onLoadCurrentStartFile = (path: string) => {
    return function () {
      if (StageManager.isEmpty()) {
        checkoutFile(path);
      } else if (currentFile === "Project Graph") {
        Dialog.show({
          title: "真的要切换吗？",
          content: "您现在的新建草稿没有保存，是否要切换项目？",
          buttons: [
            {
              text: "取消",
              onClick: () => {},
            },
            {
              text: "切换",
              onClick: () => {
                checkoutFile(path);
              },
            },
          ],
        });
      } else {
        if (StageSaveManager.isSaved()) {
          checkoutFile(path);
        } else {
          Dialog.show({
            title: "切换失败",
            content: "由于您当前的文件没有保存，请先保存后再切换文件",
            type: "error",
          });
        }
      }
    };
  };
  const checkoutFile = (path: string) => {
    try {
      setFile(decodeURIComponent(path));
      if (isDesktop && !path.endsWith(".json")) {
        Dialog.show({
          title: "请选择一个JSON文件",
          type: "error",
        });
        return;
      }
      FileLoader.openFileByPath(path);
    } catch (error) {
      Dialog.show({
        title: "请选择正确的JSON文件",
        content: String(error),
        type: "error",
      });
    }
  };

  const onRemoveFile = (path: string) => {
    return function () {
      StartFilesManager.removeStartFile(path).then((res) => {
        if (res) {
          updateStartFiles();
        } else {
          Dialog.show({
            title: "从列表中移除失败",
            content: `文件不存在：${path}`,
            type: "error",
          });
        }
      });
    };
  };

  return (
    // 群友joe说蓝色一点更好看
    <div
      className={cn(
        "bg-panel-bg text-panel-text pointer-events-none fixed left-1/2 top-1/2 z-10 flex h-4/5 w-3/4 -translate-x-1/2 -translate-y-1/2 scale-75 transform flex-col items-center overflow-y-scroll rounded-md px-2 py-6 opacity-0",
        {
          "pointer-events-auto scale-100 opacity-100": open,
          "opacity-20": isPanelTransparent,
        },
      )}
      onClick={(e) => {
        e.stopPropagation();
      }}
    >
      <h2 className="mb-3 text-xl font-bold">{t("title")}</h2>
      <p className="text-panel-warning-text mb-3 text-xs">
        警告：近期发现部分用户反映此功能异常，自动打开文件时小概率导致文件内全部连线丢失，请谨慎使用！
      </p>
      <p className="text-panel-warning-text mb-3 text-xs">不要自动加载重要且庞大的文件</p>
      <div className="mb-3 flex justify-between">
        <IconButton onClick={onAddFile}>
          <span className="flex">
            <FilePlus2 />
            {t("buttons.addFile")}
          </span>
        </IconButton>
        <IconButton onClick={onClearList}>
          <span className="flex">
            <Trash2 />
            {t("buttons.clearList")}
          </span>
        </IconButton>
        <IconButton onClick={updateStartFiles}>
          <span className="flex">
            <RefreshCw />
          </span>
        </IconButton>
        <IconButton onClick={() => setIsPanelTransparent(!isPanelTransparent)}>
          {isPanelTransparent ? <Eye /> : <EyeClosed />}
        </IconButton>
      </div>
      <table className="bg-panel-bg overflow-hidden rounded-lg border border-gray-600 shadow-lg">
        <thead>
          {/* <tr className="text-white">
            <th className="mx-4 py-2 text-left">状态</th>
            <th className="mx-4 py-2 text-left">路径</th>
            {isShowTime && <th className="mx-4 py-2 text-left">时间</th>}
            <th className="mx-4 py-2 text-left">操作</th>
          </tr> */}
        </thead>
        <tbody>
          {startFiles.map((file) => (
            <tr key={file.path} className={cn("text-panel-text border-icon-button-border border-b p-2")}>
              <td className="w-10 text-center">
                <div className="inline-block animate-bounce">{currentStartFile === file.path ? "📌" : ""}</div>
              </td>
              <td className="">
                <div className="flex w-64 flex-col">
                  <span className={cn("truncate")}>{PathString.absolute2file(file.path)}</span>
                  {isShowAbsolutePath && <span className="text-xs text-gray-500">{file.path}</span>}
                </div>
              </td>
              {isShowTime && (
                <td className="text-gray-500">
                  {new Date(file.time).toLocaleString("zh-CN", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    weekday: "long",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    hour12: false,
                  })}
                </td>
              )}
              <td className="flex justify-end">
                {currentFile !== file.path && (
                  <button className="mx-0.5 px-2 py-1 hover:cursor-pointer" onClick={onLoadCurrentStartFile(file.path)}>
                    <HardDriveDownload className="hover:cursor-pointer" />
                  </button>
                )}
                <button className="mx-0.5 px-2 py-1 hover:cursor-pointer" onClick={onSetCurrentStartFile(file.path)}>
                  {currentStartFile === file.path ? (
                    <Pin className="hover:cursor-pointer" />
                  ) : (
                    <PinOff className="hover:cursor-pointer" />
                  )}
                </button>
                <button className="mx-0.5 px-2 py-1 hover:cursor-pointer" onClick={onRemoveFile(file.path)}>
                  <Delete className="hover:cursor-pointer" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div>
        <div className="text-panel-details-text mt-3 text-sm">
          <p className="flex h-8 items-center">{t("tips.0")}</p>
          <p className="flex h-8 items-center">
            <HardDriveDownload />
            {t("tips.1")}
          </p>
          <p className="flex h-8 items-center">
            <Pin />
            {t("tips.2")}
          </p>
          <p className="flex h-8 items-center">
            <Delete />
            {t("tips.3")}
          </p>
        </div>
        <div>
          <div className="flex flex-nowrap items-center justify-center">
            <span className="mr-2 flex">
              <FolderTree />
              {t("buttons.showAbsolutePath")}
            </span>
            <Switch value={isShowAbsolutePath} onChange={(v) => setIsShowAbsolutePath(v)} />
          </div>
          <div className="flex flex-nowrap items-center justify-center">
            <span className="mr-2 flex">
              <FileClock />
              {t("buttons.showFileTime")}
            </span>
            <Switch value={isShowTime} onChange={(v) => setIsShowTime(v)} />
          </div>
        </div>
      </div>
    </div>
  );
}
