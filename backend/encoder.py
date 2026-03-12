import torch
import torchvision.transforms as transforms
from PIL import Image
from transformers import AutoTokenizer
from model import CLIPEmbeddingModel, PhoBERTEmbedding


device = "cpu"          


clip_model = CLIPEmbeddingModel().to(device)
clip_model.load_state_dict(
    torch.load("model/clip_model.pt", map_location=device)
)
clip_model.eval()


phobert_model = PhoBERTEmbedding().to(device)
phobert_model.load_state_dict(
    torch.load("model/phobert_best.pt", map_location=device)
)
phobert_model.eval()


tokenizer = AutoTokenizer.from_pretrained("vinai/phobert-base")


transform = transforms.Compose([
    transforms.Resize((224,224)),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.48145466,0.4578275,0.40821073],
        std=[0.26862954,0.26130258,0.27577711]
    )
])


def encode_image(image_source):

    image_stream = getattr(image_source, "stream", image_source)

    if hasattr(image_stream, "seek"):
        image_stream.seek(0)

    img = Image.open(image_stream).convert("RGB")

    img = transform(img).unsqueeze(0).to(device)

    with torch.no_grad():

        emb = clip_model(img)

    return emb.cpu()


def encode_text(text):

    tokens = tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        padding=True
    )

    tokens = {k:v.to(device) for k,v in tokens.items()}

    with torch.no_grad():

        emb = phobert_model(
            input_ids=tokens["input_ids"],
            attention_mask=tokens["attention_mask"]
        )

    return emb.cpu()