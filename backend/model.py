import torch
import torch.nn as nn
import torch.nn.functional as F
from transformers import CLIPModel, AutoModel


embedding_dim = 512


class CLIPEmbeddingModel(nn.Module):

    def __init__(self):

        super().__init__()

        self.clip = CLIPModel.from_pretrained(
            "openai/clip-vit-base-patch32"
        )

        for param in self.clip.parameters():
            param.requires_grad = False

        for layer in self.clip.vision_model.encoder.layers[-6:]:
            for param in layer.parameters():
                param.requires_grad = True

        self.embedding = nn.Sequential(
            nn.Linear(512,512),
            nn.ReLU(),
            nn.Linear(512,embedding_dim)
        )

    def forward(self,x):

        outputs = self.clip.vision_model(pixel_values=x)

        cls = outputs.last_hidden_state[:,0]

        features = self.clip.visual_projection(cls)

        emb = self.embedding(features)

        emb = F.normalize(emb,dim=1)

        return emb


class PhoBERTEmbedding(nn.Module):

    def __init__(self):

        super().__init__()

        self.phobert = AutoModel.from_pretrained("vinai/phobert-base")

        self.proj = nn.Sequential(
            nn.Linear(768,512),
            nn.GELU(),
            nn.LayerNorm(512),
            nn.Linear(512,512)
        )

    def mean_pool(self, output, mask):

        token_emb = output.last_hidden_state
        mask = mask.unsqueeze(-1)

        emb = (token_emb * mask).sum(1) / mask.sum(1)

        return emb

    def forward(self, input_ids, attention_mask):

        out = self.phobert(
            input_ids=input_ids,
            attention_mask=attention_mask
        )

        emb = self.mean_pool(out, attention_mask)

        emb = self.proj(emb)

        emb = F.normalize(emb, dim=-1)

        return emb