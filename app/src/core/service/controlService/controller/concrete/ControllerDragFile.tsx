import { Color, Vector } from "@graphif/data-structures";
import { writeFile } from "@tauri-apps/plugin-fs";
import { v4 as uuidv4 } from "uuid";
import { Dialog } from "../../../../../components/dialog";
import { Path } from "../../../../../utils/path";
import { PathString } from "../../../../../utils/pathString";
import { ImageNode } from "../../../../stage/stageObject/entity/ImageNode";
import { SvgNode } from "../../../../stage/stageObject/entity/SvgNode";
import { TextNode } from "../../../../stage/stageObject/entity/TextNode";
import { CircleChangeRadiusEffect } from "../../../feedbackService/effectEngine/concrete/CircleChangeRadiusEffect";
import { TextRiseEffect } from "../../../feedbackService/effectEngine/concrete/TextRiseEffect";
import { ViewFlashEffect } from "../../../feedbackService/effectEngine/concrete/ViewFlashEffect";
import { ControllerClassDragFile } from "../ControllerClassDragFile";

export class ControllerDragFileClass extends ControllerClassDragFile {
  /**
   * 处理文件拖入窗口事件
   * @param event
   */
  dragEnter = (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingFile = true;
    this.project.effects.addEffect(new TextRiseEffect("正在拖入文件"));
    this.draggingLocation = this.project.renderer.transformView2World(new Vector(event.clientX, event.clientY));
  };

  /**
   * 处理文件拖入后 在窗口内**移动**的事件
   * 这个会频繁触发
   * @param event
   */
  dragOver = (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    this.draggingLocation = this.project.renderer.transformView2World(new Vector(event.clientX, event.clientY));
  };

  /**
   * 处理文件拖入后丢入到窗口内的事件
   * @param event
   * @returns
   */
  drop = async (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const mouseWorldLocation = this.project.renderer.transformView2World(new Vector(event.clientX, event.clientY));

    const files = event.dataTransfer?.files;

    if (files) {
      if (files.length === 0) {
        // 在别的浏览器中选中文字并拽到窗口里释放会走这个if分支
        await this.dealTempFileDrop(mouseWorldLocation);
      }
      let i = -1;
      for (const file of files) {
        i++;
        if (file.type.includes("json")) {
          await this.dealJsonFileDrop(file, mouseWorldLocation);
        } else if (file.type.includes("text")) {
          this.readFileText(file).then((dataString) => {
            if (file.name.endsWith(".txt")) {
              this.project.stageManager.generateNodeTreeByText(dataString, 1, mouseWorldLocation);
            } else if (file.name.endsWith(".md")) {
              this.project.stageManager.generateNodeByMarkdown(dataString, mouseWorldLocation);
            } else {
              this.project.stageManager.generateNodeTreeByText(dataString, 1, mouseWorldLocation);
            }
          });
        } else if (file.type.includes("image/svg+xml")) {
          this.readFileText(file).then((dataString) => {
            const entity = new SvgNode(this.project, {
              uuid: uuidv4(),
              content: dataString,
              location: [mouseWorldLocation.x, mouseWorldLocation.y],
              size: [400, 100],
              color: [0, 0, 0, 0],
            });
            this.project.stageManager.add(entity);
          });
        } else if (file.type.includes("image/png")) {
          if (this.project.isDraft) {
            Dialog.show({
              title: "提示",
              content: "当前处于草稿状态，请先保存草稿，再拖入图片。",
              type: "warning",
              buttons: [
                { text: "确定" },
                {
                  text: "为什么？",
                  onClick: () => {
                    Dialog.show({
                      title: "解释",
                      content: "因为草稿没有文件路径，图片是基于相对路径，放在工程文件同一文件夹下存储的",
                      type: "info",
                      buttons: [
                        { text: "好" },
                        {
                          text: "抗议",
                          onClick: () => {
                            Dialog.show({
                              title: "失败",
                              // （？——？）
                              content:
                                "由于我们还没做发送网络请求的后端接口，所以暂时无法直接倾听您的声音，如果需要请在github或QQ群联系我们。",
                              type: "warning",
                            });
                          },
                        },
                      ],
                    });
                  },
                },
              ],
            });
          } else {
            await this.dealPngFileDrop(file, mouseWorldLocation);
          }
        } else {
          if (file.name.endsWith(".md")) {
            this.readFileText(file).then((dataString) => {
              this.project.stageManager.generateNodeByMarkdown(dataString, mouseWorldLocation);
            });
          }
          await this.dealUnknownFileDrop(file, mouseWorldLocation, i);
        }
      }
    }
    this.isDraggingFile = false;
  };

  dragLeave = (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingFile = false;
  };

  readFileText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsText(file); // 以文本格式读取文件内容
      reader.onload = (e) => {
        const fileContent = e.target?.result; // 读取的文件内容
        if (typeof fileContent === "string") {
          resolve(fileContent);
        } else {
          reject("文件内容不是string类型");
        }
      };
      reader.onerror = (e) => {
        reject("文件读取错误:" + e);
      };
    });
  }

  async dealTempFileDrop(mouseWorldLocation: Vector) {
    // 未知类型，按插入一个textNode判断
    this.project.effects.addEffect(new TextRiseEffect("不能直接拖入文字"));
    this.project.effects.addEffect(CircleChangeRadiusEffect.fromConnectPointShrink(mouseWorldLocation, 100));
  }

  async dealUnknownFileDrop(file: File, mouseWorldLocation: Vector, i: number) {
    // 未知类型，按插入一个textNode判断
    const textNode = new TextNode(this.project, {
      uuid: uuidv4(),
      text: file.name,
      location: [mouseWorldLocation.x, mouseWorldLocation.y],
      size: [100, 100],
      color: [0, 0, 0, 0],
      details: "unknown file type: " + file.type + "。",
    });
    textNode.move(new Vector(-textNode.rectangle.size.x / 2, -textNode.rectangle.size.y / 2 + i * 100));
    this.project.stageManager.add(textNode);
  }

  /**
   * 处理json文件拖入窗口并松开的情况
   * @param file
   * @param mouseWorldLocation
   */
  async dealJsonFileDrop(file: File, mouseWorldLocation: Vector) {
    // 将鼠标位置整数化
    mouseWorldLocation = new Vector(Math.round(mouseWorldLocation.x), Math.round(mouseWorldLocation.y));

    const reader = new FileReader();
    reader.readAsText(file); // 以文本格式读取文件内容

    reader.onload = (e) => {
      const fileContent = e.target?.result; // 读取的文件内容

      // 在这里处理读取到的内容
      const dataString = fileContent?.toString();
      if (dataString === undefined) {
        Dialog.show({
          title: "提示",
          content: "文件内容为空",
          type: "warning",
        });
        this.project.effects.addEffect(new TextRiseEffect("文件内容为空"));
      } else {
        // 检测是否有图片节点
        if (dataString.includes("core:image_node")) {
          Dialog.show({
            title: "提示：json中含有图片节点",
            content:
              "您正在将一个含有图片节点的json文件附加到当前舞台中，这会导致图片的丢失，您需要手动将涉及到的所有图片复制到当前json的文件夹下",
            type: "warning",
          });
        }
        Dialog.show({
          title: "确认追加",
          content: `正在准备将json文件中的内容追加到舞台中的 ${mouseWorldLocation.toString()} 坐标位置上，是否继续？\n注意：拖动文件进入舞台不是打开，是追加！`,
          type: "info",
          buttons: [
            {
              text: "确定",
              onClick: () => {
                this.project.stageManager.add(
                  ProjectFormatUpgrader.upgrade(JSON.parse(dataString)),
                  mouseWorldLocation,
                );
                this.project.effects.addEffect(new ViewFlashEffect(Color.White));
              },
            },
            { text: "取消" },
          ],
        });
      }
    };

    reader.onerror = (e) => {
      console.error("文件读取错误:", e);
      this.project.effects.addEffect(new TextRiseEffect("文件读取错误:" + e));
      this.project.effects.addEffect(new ViewFlashEffect(Color.Red));
    };
  }

  async dealPngFileDrop(file: File, mouseWorldLocation: Vector) {
    const imageUUID = uuidv4();
    const folderPath = new Path(this.project.uri).parent.toString();
    await writeFile(`${folderPath}${PathString.getSep()}${imageUUID}.png`, new Uint8Array(await file.arrayBuffer()));
    const imageNode = new ImageNode(this.project, {
      uuid: imageUUID,
      location: [mouseWorldLocation.x, mouseWorldLocation.y],
      path: `${imageUUID}.png`,
    });
    this.project.stageManager.add(imageNode);
  }
}
