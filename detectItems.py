import boto3
import cv2
import numpy as np
import os
import shutil

# AWS credentials (replace with your actual credentials)
aws_access_key = '<Access Key>'
aws_secret_key = '<Secret Key>'

shopping_keywords = [
    
    'Adult','Accessories', 'Anklet', 'Backpack', 'Bag', 'Bandana', 'Bangles', 'Baseball Cap', 'Beanie', 
    'Belt', 'Bikini', 'Blazer', 'Blouse', 'Boot', 'Bow Tie', 'Bra', 'Bracelet', 'Brooch', 
    'Cap', 'Cardigan', 'Clothing', 'Coat', 'Corset', 'Costume', 'Cowboy Boot', 'Cowboy Hat', 
    'Crown', 'Diaper', 'Digital Watch', 'Dress', 'Dress Shirt', 'Earring', 'Evening Dress', 
    'Fashion', 'Flip-Flop', 'Footwear', 'Formal Wear', 'Glasses', 'Glove', 'Gown', 'Handbag', 
    'Hat', 'Headband', 'Helmet', 'High Heel', 'Hoodie', 'Hosiery', 'Jacket', 'Jeans', 'Jewelry', 
    'Kimono', 'Knitwear', 'Lingerie', 'Mannequin', 'Mask', 'Miniskirt', 'Necklace', 'Necktie', 
    'Overcoat', 'Pajamas', 'Panties', 'Pants', 'Pantyhose', 'Pearl', 'Pendant', 'Perfume', 'Pin', 
    'Poncho', 'Purse', 'Raincoat', 'Ring', 'Robe', 'Running Shoe', 'Sandal', 'Scarf', 'Shirt', 
    'Shoe', 'Shorts', 'Silk', 'Skirt', 'Sneaker', 'Sock', 'Suit', 'Sun Hat', 'Sunglasses', 
    'Suspenders', 'Sweater', 'Sweatshirt', 'Swimwear', 'Tank Top', 'Tie', 'Tights', 'Tote Bag', 
    'Trench Coat', 'T-Shirt', 'Tuxedo', 'Underwear', 'Veil', 'Vest', 'Wallet', 'Wedding Gown', 
    'Wig', 'Wristwatch',
    'Barbershop', 'Beauty Salon', 'Black Hair', 'Blonde', 'Blue Hair', 'Braid', 'Brown Hair', 
    'Bun (Hairstyle)', 'Cornrows', 'Cosmetics', 'Curly Hair', 'Face Makeup', 'Green Hair', 
    'Hair', 'Haircut', 'Highlighted Hair', 'Lipstick', 'Makeup', 'Manicure', 'Mascara', 
    'Mohawk Hairstyle', 'Nail Polish', 'Pink Hair', 'Pixie Cut', 'Red Hair', 'Shampoo', 'Spa', 
    'Tattoo', 'Toothbrush',
    'Wall Clock','Refrigerator',
    'Armchair', 'Bar Stool', 'Bean Bag', 'Bed Sheet', 'Bench', 'Bookcase', 'Cabinet', 'Chair', 
    'Coffee Table', 'Couch', 'Curtain', 'Desk', 'Dining Table', 'Dresser', 'Floor Lamp', 'Furniture', 
    'Lamp', 'Lampshade', 'Mattress', 'Ottoman', 'Painting', 'Photo Frame', 'Poster', 'Quilt', 
    'Recliner', 'Rocking Chair', 'Rug', 'Shelf', 'Stand', 'Table', 'Table Lamp', 'Vase', 'Window Shade'
]

small_area_objects = [
    'Accessories', 'Anklet', 'Bandana', 'Bangles', 'Bracelet', 'Brooch', 'Digital Watch', 'Earring', 
    'Jewelry', 'Necklace', 'Pendant', 'Perfume', 'Pin', 'Ring', 'Scarf', 'Tie'
]

# Initialize AWS Rekognition client
reko_client = boto3.client('rekognition',
                           aws_access_key_id=aws_access_key,
                           aws_secret_access_key=aws_secret_key,
                           region_name='us-east-1')

def detect_labels(image_bytes):
    response = reko_client.detect_labels(Image={'Bytes': image_bytes}, MinConfidence=10)  # Set MinConfidence to 0
    return response['Labels']

def process_image(image_path):
    if not os.path.isfile(image_path):
        raise FileNotFoundError(f"The image file was not found: {image_path}")
    
    image = cv2.imread(image_path)
    if image is None:
        raise ValueError(f"Failed to load image. Please check the file path and integrity: {image_path}")
    
    _, buffer = cv2.imencode('.jpg', image)
    image_bytes = buffer.tobytes()

    labels = detect_labels(image_bytes)

    detected_objects = []
    output_dir = 'imgs'
    os.makedirs(output_dir, exist_ok=True)

    for filename in os.listdir(output_dir):
        file_path = os.path.join(output_dir, filename)
        if os.path.isfile(file_path) or os.path.islink(file_path):
            os.unlink(file_path)
        elif os.path.isdir(file_path):
            shutil.rmtree(file_path)

    image_height, image_width, _ = image.shape
    image_area = image_height * image_width


    with open('detected_labels.txt', 'w') as f:
        for label in labels:
            if any(keyword.lower() in label['Name'].lower() for keyword in shopping_keywords):
                for instance in label.get('Instances', [{'BoundingBox': {'Left': 0, 'Top': 0, 'Width': 1, 'Height': 1}}]):
                    bbox = instance['BoundingBox']
                    confidence = label['Confidence']
                    bbox_width = int(bbox['Width'] * image_width)
                    bbox_height = int(bbox['Height'] * image_height)
                    bbox_area = bbox_width * bbox_height
                    relative_area = bbox_area / image_area
                    detected_objects.append({
                        'Name': label['Name'],
                        'Confidence': confidence,
                        'BoundingBox': bbox,
                        'RelativeArea': relative_area
                    })

    # Sort objects by label name and then by relative area and confidence (prominence)
    detected_objects = sorted(detected_objects, key=lambda x: (x['Name'], x['RelativeArea'], x['Confidence']), reverse=True)

    # Keep only the most prominent instance of each label
    # top_objects = []
    top_objects = detected_objects
    # seen_labels = set()
    # for obj in detected_objects:
    #     # if obj['Name'] not in seen_labels or obj['Name'] in small_area_objects:
    #     if obj['Name'] in small_area_objects:
    #         top_objects.append(obj)
            # seen_labels.add(obj['Name'])

    for obj in top_objects:
        bbox = obj['BoundingBox']
        x = int(bbox['Left'] * image_width)
        y = int(bbox['Top'] * image_height)
        w = int(bbox['Width'] * image_width)
        h = int(bbox['Height'] * image_height)
        object_img = image[y:y+h, x:x+w]
        object_img_path = os.path.join(output_dir, f"{obj['Name']}_{obj['Confidence']:.2f}_{x}_{y}.png")
        cv2.imwrite(object_img_path, object_img)

        with open('detected_labels.txt', 'a') as f:
            f.write(f"Name: {obj['Name']}, Confidence: {obj['Confidence']:.2f}, Relative Area: {obj['RelativeArea']:.2f}, File: {object_img_path}\n")

    # Now draw bounding boxes and labels on the image
    for obj in top_objects:
        bbox = obj['BoundingBox']
        x = int(bbox['Left'] * image_width)
        y = int(bbox['Top'] * image_height)
        w = int(bbox['Width'] * image_width)
        h = int(bbox['Height'] * image_height)
        box_color = (0, 255, 0)
        cv2.rectangle(image, (x, y), (x + w, y + h), box_color, 2)
        cv2.putText(image, f"{obj['Name']} ({obj['Confidence']:.2f})", (x, y - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, box_color, 2)

    return image, top_objects

if __name__ == "__main__":
    img_path = 'uploads/frame.png'  # Path to the uploaded image

    try:
        annotated_image, detected_objects = process_image(img_path)
        cv2.imwrite('./annotatedImage.png', annotated_image)
    except (FileNotFoundError, ValueError) as e:
        print(e)
        exit(1)