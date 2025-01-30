from typing import Optional, Dict, Any, List
from datetime import datetime
import torch
import logging
from transformers import AutoModelForCausalLM, AutoTokenizer
from src.shared.config.ai_model import MODEL_CONFIG
from src.shared.cache.hybrid_cache import HybridCache
from src.shared.models.cache import ModelOutputCache
from src.shared.monitor.metrics import track_inference_time, track_memory_usage
from functools import wraps

class DeepSeek1_5B:
    def __init__(self, quantized: bool = True):
        self.config = MODEL_CONFIG
        self.device = torch.device(self.config.DEVICE if torch.cuda.is_available() else "cpu")
        self.cache = HybridCache()
        self.initial_memory = None
        
        try:
            if torch.cuda.is_available():
                torch.cuda.reset_peak_memory_stats()
                self.initial_memory = torch.cuda.memory_allocated()
            
            load_kwargs = {}
            if quantized:
                import bitsandbytes as bnb
                load_kwargs.update({
                    "load_in_4bit": True,
                    "bnb_4bit_compute_dtype": torch.float16,
                    "bnb_4bit_quant_type": "nf4",
                    "bnb_4bit_use_double_quant": True,
                })
            
            self.model = AutoModelForCausalLM.from_pretrained(
                self.config.MODEL_NAME,
                device_map=self.device,
                **load_kwargs
            )
            self.tokenizer = AutoTokenizer.from_pretrained(self.config.MODEL_NAME)
            
            if quantized and torch.cuda.is_available():
                final_memory = torch.cuda.memory_allocated()
                memory_reduction = 1 - (final_memory / self.initial_memory) if self.initial_memory and self.initial_memory > 0 else 0
                print(f"GPU Memory Usage: {final_memory/(1024*1024):.2f}MB")
                print(f"Memory Reduction: {memory_reduction*100:.1f}%")
        except Exception as e:
            print(f"Error initializing model: {str(e)}")
            raise
            
    def get_memory_stats(self) -> Dict[str, float]:
        if not torch.cuda.is_available():
            return {"current_memory_mb": 0.0, "peak_memory_mb": 0.0, "memory_reduction": 0.0}
            
        current_memory = torch.cuda.memory_allocated()
        peak_memory = torch.cuda.max_memory_allocated()
        
        return {
            "current_memory_mb": current_memory / (1024 * 1024),
            "peak_memory_mb": peak_memory / (1024 * 1024),
            "memory_reduction": 1 - (current_memory / self.initial_memory) if self.initial_memory else 0
        }
        
    @track_inference_time
    async def generate(self, prompt: str, **kwargs) -> Dict[str, Any]:
        from src.shared.monitor.metrics import track_memory_usage
        try:
            if torch.cuda.is_available():
                track_memory_usage(torch.cuda.memory_allocated())
            import hashlib
            prompt_hash = hashlib.sha256(prompt.encode()).hexdigest()
            
            cached = self.cache.get(f"model_output:{prompt_hash}")
            if cached:
                return cached.output
            
            inputs = self.tokenizer(prompt, return_tensors="pt", truncation=True, 
                                  max_length=self.config.MAX_SEQ_LEN).to(self.device)
            
            with torch.inference_mode(), torch.cuda.amp.autocast():
                outputs = self.model.generate(
                    **inputs,
                    max_new_tokens=512,
                    temperature=self.config.TEMPERATURE,
                    pad_token_id=self.tokenizer.eos_token_id,
                    **kwargs
                )
            
            response = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
            result = {"text": response, "confidence": self.config.MIN_CONFIDENCE}
            
            cache_entry = ModelOutputCache(
                prompt_hash=prompt_hash,
                output=result,
                timestamp=datetime.now(),
                model_name=self.config.MODEL_NAME
            )
            self.cache.set(f"model_output:{prompt_hash}", cache_entry)
            
            return result
        except Exception as e:
            print(f"Error during generation: {str(e)}")
            return {"text": "", "confidence": 0.0}
            
    async def generate_batch(self, prompts: List[str], **kwargs) -> List[Dict[str, Any]]:
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
