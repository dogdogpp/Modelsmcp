import os
from ultralytics import YOLO
import cv2

# 加载预训练的 YOLOv8 模型
model = YOLO('yolo26n.pt')  # 使用小型的 yolo26n 模型

def infer(image_path, output_path):
    # 对图像进行推理
    results = model(image_path)
    
    # 处理结果
    for i, r in enumerate(results):
        # 保存结果图像
        annotated_frame = r.plot()
        cv2.imwrite(output_path, annotated_frame)
        print(f"推理结果已保存到: {output_path}")
        
        # 打印检测到的对象
        for box in r.boxes:
            class_id = int(box.cls[0])
            class_name = model.names[class_id]
            confidence = float(box.conf[0])
            print(f"检测到: {class_name}, 置信度: {confidence:.2f}")

if __name__ == "__main__":
    # 检查 test.png 是否存在
    if os.path.exists("test.png"):
        infer("test.png", "output_real.png")
    else:
        print("错误: test.png 文件不存在")
