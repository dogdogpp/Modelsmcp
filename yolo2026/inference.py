import torch
from PIL import Image
import numpy as np
import cv2
from model import load_model

# 加载模型
model = load_model()

# 预处理图片
def preprocess_image(image_path):
    img = Image.open(image_path)
    img = img.resize((416, 416))
    img = np.array(img)
    img = img / 255.0
    img = img.transpose(2, 0, 1)
    img = torch.tensor(img, dtype=torch.float32).unsqueeze(0)
    return img

# 后处理结果
def postprocess_output(output, image_shape):
    # 简单的后处理实现
    # 这里只是一个示例，实际 YOLO 后处理会更复杂
    return []

# 绘制检测结果
def draw_detections(image, detections):
    # 绘制检测框
    for det in detections:
        x1, y1, x2, y2, conf, cls = det
        cv2.rectangle(image, (int(x1), int(y1)), (int(x2), int(y2)), (0, 255, 0), 2)
        cv2.putText(image, f'Class: {int(cls)}, Conf: {conf:.2f}', 
                    (int(x1), int(y1)-10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
    return image

# 推理函数
def infer(image_path, output_path):
    # 预处理
    input_tensor = preprocess_image(image_path)
    
    # 模型推理
    with torch.no_grad():
        output = model(input_tensor)
    
    # 后处理
    image = cv2.imread(image_path)
    detections = postprocess_output(output, image.shape)
    
    # 绘制结果
    result_image = draw_detections(image, detections)
    
    # 保存结果
    cv2.imwrite(output_path, result_image)
    print(f"推理结果已保存到: {output_path}")

if __name__ == "__main__":
    # 创建测试图片
    test_image = np.zeros((416, 416, 3), dtype=np.uint8)
    cv2.rectangle(test_image, (100, 100), (300, 300), (255, 0, 0), 2)
    cv2.putText(test_image, "Test Image", (150, 200), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
    cv2.imwrite("test_image.jpg", test_image)
    
    # 运行推理
    infer("test_image.jpg", "output.jpg")
    print("推理完成！")