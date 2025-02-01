from typing import Optional, Dict, Any, List, ContextManager
from datetime import datetime
import torch
import logging
from contextlib import nullcontext
from transformers import AutoModelForCausalLM, AutoTokenizer
from src.shared.config.ai_model import MODEL_CONFIG
from src.shared.models.cache_types import ModelOutputCache


def get_cache():
    from src.shared.cache.hybrid_cache import HybridCache

    return HybridCache()


from src.shared.monitor.metrics import track_inference_time, track_memory_usage
from functools import wraps


class DeepSeek1_5B:
    def __init__(self, quantized: bool = True):
        self.config = MODEL_CONFIG
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.cache = get_cache()
        self.initial_memory = None
        self._quantized = quantized and torch.cuda.is_available()
        self._setup_model()

    def _setup_model(self):
        if torch.cuda.is_available():
            try:
                torch.cuda.reset_peak_memory_stats()
                self.initial_memory = torch.cuda.memory_allocated()
            except RuntimeError:
                logging.warning("CUDA memory tracking not available")
                self.initial_memory = 0

        load_kwargs = {"device_map": self.device}
        if self._quantized and torch.cuda.is_available():
            import bitsandbytes as bnb

            load_kwargs.update(
                {
                    "load_in_4bit": True,
                    "bnb_4bit_compute_dtype": torch.float16,
                    "bnb_4bit_quant_type": "nf4",
                    "bnb_4bit_use_double_quant": True,
                }
            )

        self.model = AutoModelForCausalLM.from_pretrained(
            self.config.MODEL_NAME, **load_kwargs
        )
        self.tokenizer = AutoTokenizer.from_pretrained(self.config.MODEL_NAME)

        if self._quantized and torch.cuda.is_available():
            try:
                final_memory = torch.cuda.memory_allocated()
                memory_reduction = (
                    1 - (final_memory / self.initial_memory)
                    if self.initial_memory and self.initial_memory > 0
                    else 0
                )
                print(f"GPU Memory Usage: {final_memory/(1024*1024):.2f}MB")
                print(f"Memory Reduction: {memory_reduction*100:.1f}%")
            except RuntimeError:
                logging.warning("CUDA memory tracking not available")

    @property
    def quantized(self) -> bool:
        return self._quantized

    def get_memory_stats(self) -> Dict[str, float]:
        try:
            if not torch.cuda.is_available():
                return {
                    "current_memory_mb": 0.0,
                    "peak_memory_mb": 0.0,
                    "memory_reduction": 0.0,
                }

            current_memory = torch.cuda.memory_allocated()
            peak_memory = torch.cuda.max_memory_allocated()

            return {
                "current_memory_mb": current_memory / (1024 * 1024),
                "peak_memory_mb": peak_memory / (1024 * 1024),
                "memory_reduction": (
                    1 - (current_memory / self.initial_memory)
                    if self.initial_memory and self.initial_memory > 0
                    else 0
                ),
            }
        except RuntimeError:
            return {
                "current_memory_mb": 0.0,
                "peak_memory_mb": 0.0,
                "memory_reduction": 0.0,
            }

    @track_inference_time
    async def generate(self, prompt: str, **kwargs) -> Dict[str, Any]:
        if not prompt:
            return {"text": "", "confidence": 0.0}

        try:
            import hashlib

            prompt_hash = hashlib.sha256(prompt.encode()).hexdigest()
            cache_key = f"model_output:{prompt_hash}"

            cached = self.cache.get(cache_key)
            if cached:
                if isinstance(cached, ModelOutputCache):
                    return cached.output
                elif isinstance(cached, dict):
                    return cached

            if not hasattr(self, "model") or not hasattr(self, "tokenizer"):
                return {"text": "", "confidence": 0.0}

            try:
                inputs = self.tokenizer(
                    prompt,
                    return_tensors="pt",
                    truncation=True,
                    max_length=self.config.MAX_SEQ_LEN,
                )
                if torch.cuda.is_available():
                    inputs = {k: v.to(self.device) for k, v in inputs.items()}

                with torch.inference_mode():
                    with (
                        torch.cuda.amp.autocast()
                        if self._quantized and torch.cuda.is_available()
                        else nullcontext()
                    ):
                        outputs = self.model.generate(
                            **inputs,
                            max_new_tokens=kwargs.get("max_new_tokens", 512),
                            temperature=kwargs.get(
                                "temperature", self.config.TEMPERATURE
                            ),
                            pad_token_id=self.tokenizer.eos_token_id,
                            **{
                                k: v
                                for k, v in kwargs.items()
                                if k not in ["max_new_tokens", "temperature"]
                            },
                        )

                if isinstance(outputs, torch.Tensor):
                    response = self.tokenizer.decode(
                        outputs[0], skip_special_tokens=True
                    )
                    result = {
                        "text": response,
                        "confidence": self.config.MIN_CONFIDENCE,
                    }

                    cache_entry = ModelOutputCache(
                        prompt_hash=prompt_hash,
                        output=result,
                        timestamp=datetime.now(),
                        model_name=self.config.MODEL_NAME,
                    )
                    self.cache.set(cache_key, cache_entry)

                    return result
                return {"text": "", "confidence": 0.0}
            except Exception as e:
                logging.error(f"Model generation error: {str(e)}")
                return {"text": "", "confidence": 0.0}
        except Exception as e:
            logging.error(f"Model generation error: {str(e)}")
            return {"text": "", "confidence": 0.0}

    async def generate_batch(
        self, prompts: List[str], **kwargs
    ) -> List[Dict[str, Any]]:
        """Generate responses for multiple prompts in batch."""
        results = []
        for prompt in prompts:
            try:
                result = await self.generate(prompt, **kwargs)
                results.append(result)
            except Exception as e:
                print(f"Error in batch generation for prompt: {str(e)}")
                results.append({"text": "", "confidence": 0.0})
        return results
