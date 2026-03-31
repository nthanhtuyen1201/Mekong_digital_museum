import modal

app = modal.App("mekong-chatbot")

image = modal.Image.debian_slim().pip_install(
    "torch",
    "transformers",
    "peft",
    "fastapi[standard]"
)

image = image.add_local_dir("lora_model", "/root/lora_model")


@app.function(image=image, gpu="any", timeout=120)
@modal.fastapi_endpoint(method="POST")
def generate(request: dict):
    import torch
    from transformers import AutoTokenizer, AutoModelForCausalLM
    from peft import PeftModel

    if not hasattr(generate, "model"):
        model_name = "TinyLlama/TinyLlama-1.1B-Chat-v1.0"

        generate.tokenizer = AutoTokenizer.from_pretrained(model_name)

        base_model = AutoModelForCausalLM.from_pretrained(
            model_name,
            torch_dtype=torch.float16,
            device_map="auto"
        )

        generate.model = PeftModel.from_pretrained(
            base_model,
            "/root/lora_model"
        )

    tokenizer = generate.tokenizer
    model = generate.model

    question = request.get("question", "")
    context = request.get("context", "")

    prompt = f"""
Bạn là chatbot hỏi đáp.

Nhiệm vụ:
- Trả lời câu hỏi dựa trên dữ liệu cung cấp
- Có thể diễn đạt lại cho tự nhiên
- KHÔNG được thay đổi thông tin quan trọng
- KHÔNG thêm thông tin ngoài dữ liệu

Dữ liệu:
{context}

Câu hỏi:
{question}

### Trả lời:
"""

    device = "cuda" if torch.cuda.is_available() else "cpu"

    inputs = tokenizer(prompt, return_tensors="pt").to(device)

    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=60,
            do_sample=False
        )

    result = tokenizer.decode(outputs[0], skip_special_tokens=True)

    if "### Trả lời:" in result:
        result = result.split("### Trả lời:")[-1]

    return {"answer": result.strip()}