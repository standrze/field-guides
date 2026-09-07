---
order: 0
id: model-training-field-guide
group: Models and training
title: Fine-tuning and Model Architecture
time: 35 min
level: Foundations
terms: PEFT LoRA QLoRA full fine-tuning dense MoE LFM Qwen gpt-oss quantization pretraining recurrent architecture
summary: A practical map of what models learn, which parameters change, and how dense, sparse, and hybrid models work.
format: markdown
---

<p class="eyebrow">AI · Model training field guide</p>

# Fine-tuning and Model Architecture

<p class="lede">A model's architecture, its training objective, and the method used to update its weights are separate choices. Understanding those choices makes model names and training recipes much easier to read.</p>

## 1. The three questions behind every training recipe

Imagine someone says: “We used QLoRA supervised fine-tuning on a dense Qwen model.” Each phrase answers a different question.

| Question | Examples | What it tells you |
|---|---|---|
| What is the model learning? | Pretraining, continued pretraining, SFT, preference optimization | The examples and learning objective |
| Which parameters change? | Full fine-tuning, LoRA, other PEFT methods | The update method |
| How does the model compute? | Dense transformer, MoE, convolution/attention hybrid | The architecture |

Precision is another choice: BF16, FP16, INT8, or a four-bit format describe numerical representations. A file format such as GGUF or Safetensors describes how data is packaged. Neither is a learning objective.

**PEFT** means *parameter-efficient fine-tuning*. It is probably the term you remembered as “perf” or “pert.” It names a category of methods and also Hugging Face's library implementing many of them. LoRA is in that category. QLoRA combines low-rank adaptation with a quantized frozen model. [PEFT overview](https://huggingface.co/docs/peft/en/index)

### Checkpoint

Can a dense model use QLoRA? Yes. Can an MoE use full fine-tuning? Yes. These labels describe different aspects of the system.

## 2. What happens inside a language model?

A tokenizer converts text into token IDs. An embedding table turns each ID into a vector: a list of numbers representing that token. A series of blocks transforms those vectors. An output projection produces scores for the possible next tokens.

```text
Text → token IDs → embeddings → model blocks → next-token scores
```

Most decoder transformers contain attention and feed-forward computations within each block, together with normalization and residual connections.

**Attention** lets a token use information from other visible tokens. In causal language modeling, it cannot read future tokens. Queries, keys, and values are learned projections used to calculate which earlier positions matter.

**The feed-forward network**, also called an MLP or FFN, transforms each token's current representation. A gated MLP such as SwiGLU uses one learned branch to modulate another. Attention and MLPs both contribute to knowledge and reasoning; there is no clean “memory department” versus “thinking department.”

**Residual connections** add a block's contribution back to its input. **Normalization** controls activation scale. **RoPE** introduces positional information into attention. **GQA**, grouped-query attention, shares key/value heads across multiple query heads, reducing the size of the attention cache relative to ordinary multi-head attention.

Weights are learned numbers stored in the checkpoint. Activations are temporary numbers calculated for the current input. Gradients describe how changing trainable weights would affect the loss. Optimizer state holds additional numbers used to choose updates.

### Checkpoint

A checkpoint fits in memory for inference. Does full training necessarily fit? No: training adds gradients, optimizer state, saved activations, and temporary buffers.

## 3. Pretraining, continued pretraining, and instruction tuning

**Pretraining from scratch** begins with newly initialized parameters. Next-token prediction over a broad corpus teaches language, code, factual associations, and patterns of reasoning. “From scratch” does not mean that the tokenizer, architecture, and software must also be invented from scratch.

**Continued pretraining**, or CPT, starts from an existing checkpoint and continues language-model training. A corpus of technical documents can shift the model toward a domain. It may also erode other capabilities if the mixture is too narrow.

**Supervised fine-tuning**, or SFT, trains on examples of the desired response to an input. For a documentation assistant, an example might contain a question, the relevant documentation, and a concise answer citing that documentation. Many conversational SFT setups calculate loss only on assistant responses, rather than teaching the model to reproduce user messages.

**Preference optimization**, such as DPO, uses preferred and dispreferred answers to adjust behavior. **Reinforcement learning** uses rewards or feedback from outcomes. Neither automatically supplies factual knowledge or makes a flawed reward trustworthy.

**Distillation** transfers behavior from a teacher into a student through outputs or other training signals. The teacher can produce mistakes; teacher-generated text still needs evaluation.

| Starting checkpoint | Already learned | Typical next step |
|---|---|---|
| Base | General language-model behavior | CPT and/or SFT |
| Instruct | Language plus instruction-following behavior | Focused SFT |
| Thinking | A post-training recipe emphasizing reasoning behavior | Task-specific evaluation before adaptation |

“Instruct” is a training history, not a different fundamental architecture. A base model can sometimes answer instructions through prompting, but dependable conversational behavior usually benefits from instruction tuning. Adding a chat template alone does not teach that behavior.

### Checkpoint

Can CPT use LoRA? Yes. Can SFT update every weight? Yes. The objective and update method are independent.

## 4. Full fine-tuning

Full fine-tuning updates all the model parameters selected for training, typically the entire network. It gives the optimizer broad freedom to adapt representations.

That flexibility costs memory. A common mixed-precision Adam accounting is approximately 16 bytes per parameter: two bytes for weights, two for gradients, four for a master copy, and eight for two optimizer moments. Implementations differ: master copies may be absent, gradients may use FP32, and optimizer state can be compressed or sharded.

For 1.2 billion parameters, that illustrative accounting gives **19.2GB of training state before activations and buffers**. It is not a universal requirement or proof that training fits in 24GB.

Full tuning can be useful when adaptation requires extensive representation changes. It is not guaranteed to outperform a well-tuned adapter, especially on a small dataset. Learning rate, coverage, regularization, and evaluation matter at least as much as the label on the method.

## 5. LoRA: learn an update to an existing matrix

LoRA freezes an original weight matrix and learns two smaller matrices whose product modifies its output:

```text
W_effective = W_frozen + scale × B × A
```

Suppose W has 2,048 rows and 2,048 columns. It contains 4,194,304 parameters. With rank 16, A and B together contain:

```text
16 × (2048 + 2048) = 65,536 trainable parameters
```

That is about 1.56% of the original matrix's parameter count. The saving applies to this example matrix, not automatically to the whole network.

**Rank** sets the size of the low-rank update. Higher rank gives more update capacity and costs more memory, but does not guarantee better quality. **Alpha** scales the update; ordinary LoRA commonly uses alpha divided by rank, while variants can scale differently. **Target modules** specify where adapters are installed. **Dropout** can regularize adapters.

Targets must match the actual model implementation. Some models expose separate attention projections; others pack them into one tensor. Expert weights may be stored as three-dimensional parameters rather than ordinary linear layers. A recipe copied from another model can adapt the wrong parts or fail entirely.

The frozen base still participates in forward computation, and gradients must propagate through relevant operations to reach adapters. LoRA does not make training as cheap as updating only its small parameter count might suggest.

Adapters can be stored separately and switched, or merged into compatible base weights. An unmerged adapter needs its exact base checkpoint and configuration. Merging adds the learned update into the weights; it does not give the model billions of new independent parameters. [LoRA conceptual guide](https://huggingface.co/docs/peft/main/conceptual_guides/lora)

### Checkpoint

If an adapter is 100MB, is the whole adapted model 100MB? No. The base checkpoint is still needed unless the adapter has been merged into a full checkpoint.

## 6. QLoRA: store the frozen base more cheaply

QLoRA keeps a quantized base model frozen and learns adapters. The original work introduced NF4, double quantization, and paged optimizers as parts of its memory-efficient approach. Modern tools sometimes use “QLoRA” more loosely for low-bit frozen-base LoRA. [QLoRA paper](https://arxiv.org/abs/2305.14314)

Storage precision and compute precision are different. Four-bit stored weights are dequantized for computation; adapter arithmetic commonly uses BF16 or FP16. The optimizer does not ordinarily update the four-bit base values.

QLoRA buys memory headroom, not guaranteed speed. Dequantization and kernel support can reduce throughput. The extra room may nevertheless permit a better batch size or sequence length.

For a small 1.2B model, ordinary BF16 LoRA is a sensible baseline if it fits. For a larger model or a longer context, QLoRA can make the experiment feasible. Exact support must be checked for the architecture and training stack. [PEFT quantization guide](https://huggingface.co/docs/peft/developer_guides/quantization)

| Property | Full fine-tuning | LoRA | QLoRA |
|---|---|---|---|
| Base weights | Trainable | Frozen | Frozen and quantized |
| Main learned change | Original parameters | Adapter matrices | Adapter matrices |
| Optimizer memory | Usually largest | Usually much smaller | Usually much smaller |
| Base-weight memory | Depends on training precision | Usually BF16/FP16 | Usually four-bit plus metadata |
| Quantization error during training | Depends on implementation | Usually absent from base storage | Present in base representation |
| Deployment artifact | Full checkpoint | Base plus adapter, or merged | Quantized base plus adapter, or tested merged export |
| Best quality automatically? | No | No | No |

Other PEFT methods include learned prompt vectors, prefix tuning, IA3 scaling vectors, and variants such as DoRA. They modify different parts of the computation. PEFT is the umbrella, not a competitor to LoRA.

## 7. Dense versus mixture of experts

In a **dense** model, tokens use the same feed-forward networks. Dense does not mean every embedding row or scalar participates in every operation; it describes the absence of sparse expert routing in this comparison.

In a **mixture-of-experts model**, an MoE block contains several feed-forward networks. A router selects a small subset for each token and combines their outputs. Attention and other shared components usually remain shared.

```text
Dense: token → shared feed-forward network → output
MoE:   token → router → selected experts → weighted combination
```

An “expert” is a learned subnet, not a separate chatbot or an assigned subject specialist. One is not necessarily the Python expert and another the history expert. Specialization emerges from training and may not match human categories.

**Total parameters** measures stored model capacity. **Active parameters** describes the subset involved per token under the publisher's convention. Both matter, but neither is a precise latency prediction.

An illustrative 20B-total/3B-active model still needs access to its 20B weights. Full training also needs state for trainable experts, even if a particular token does not select them. Across a batch, many or all experts may receive tokens. Routing, communication, and memory traffic make its speed different from a dense 3B model.

Top-k routing means selecting k experts per token in each MoE layer. It is unrelated to top-k sampling, which limits candidate output tokens during generation.

### Checkpoint

Can you size MoE training memory using only active parameters? No. Start from total trainable parameters and account for the actual sharding and precision scheme.

## 8. LFM, gpt-oss, and Qwen are not interchangeable architectures

### Liquid LFM2 and LFM2.5

LFM2 combines gated short convolution blocks with attention blocks. Convolution processes local sequential patterns; attention provides access to broader context. This hybrid changes the balance of computation and cache requirements.

The LFM2.5-1.2B family is a dense hybrid. Larger LFM MoE checkpoints add sparse feed-forward experts to the hybrid backbone. Thus a model can be both **hybrid** and **MoE**: those words describe different design choices.

Liquid's LFM2-24B-A2B uses 40 layers, 64 experts per MoE block, and top-4 routing. Its stated active count is approximately 2.3B, illustrating that the A2B name is rounded. Convolution and attention counts vary by checkpoint. [Liquid architecture explanation](https://www.liquid.ai/blog/lfm2-24b-a2b)

For adaptation, inspect attention, MLP/expert, and convolution projection modules. A default adapter recipe that only knows transformer attention names can miss useful trainable locations. “Liquid” does not mean the model rewrites its weights while you chat.

### OpenAI gpt-oss

gpt-oss-20b is an open-weight MoE model with approximately 21B total and 3.6B active parameters. It can be fine-tuned. Those numbers describe a much larger stored model than a dense 3.6B checkpoint. [Official gpt-oss-20b documentation](https://developers.openai.com/api/docs/models/gpt-oss-20b)

For practical training, verify support for its expert tensors, checkpoint precision, and conversation format. A quantized inference checkpoint that fits on a GPU does not establish that the same GPU can run full training. Generic “four-bit supported” claims do not establish compatibility with every four-bit format.

### Qwen

Qwen is a family name, not one fixed architecture. Qwen2.5-Coder-1.5B is a dense transformer with grouped-query attention and code-focused training. Qwen3 includes both dense models and sparse MoE models, such as Qwen3-30B-A3B. [Qwen2.5-Coder model card](https://huggingface.co/Qwen/Qwen2.5-Coder-1.5B), [Qwen3 architecture lineup](https://qwenlm.github.io/blog/qwen3/)

Do not infer the architecture of another Qwen generation from those examples. Identify the complete checkpoint name, then inspect its model card, configuration, and supported implementation.

| Example | Token processing | Feed-forward structure | Main practical implication |
|---|---|---|---|
| LFM2.5-1.2B | Convolution/attention hybrid | Dense | Check hybrid training and adapter support |
| LFM2-24B-A2B | Convolution/attention hybrid | MoE | Sparse compute, large total weight storage |
| gpt-oss-20b | Transformer attention | MoE | Format and expert implementation matter |
| Qwen2.5-Coder-1.5B | Transformer attention | Dense | Small code-focused baseline |
| Qwen3-30B-A3B | Transformer attention | MoE | Total size and active size differ |

### Checkpoint

Is “hybrid versus MoE” a valid either/or choice? No. Hybrid describes the mix of token-processing blocks; MoE describes sparse expert selection.

## 9. Recurrent depth and latent reasoning

The Huginn paper from our conversation explores repeated use of a shared recurrent block. Extra iterations add computation without adding an independent set of weights for every iteration. [Huginn paper](https://arxiv.org/abs/2502.05171)

This is different from LFM's short convolution and from MoE routing. More iterations can improve some tasks after suitable training, but do not guarantee improvement on every task. A model's computational depth is not the same as its independent parameter capacity.

A standard LFM checkpoint does not acquire Huginn-style reasoning merely because you apply LoRA. Introducing recurrence changes the forward computation and creates a separate architecture experiment. A “Thinking” suffix alone also does not establish latent recurrence.

## 10. Read a checkpoint before choosing a recipe

Record the exact model revision, tokenizer revision, license, and implementation version. Then inspect:

| Configuration field | Meaning |
|---|---|
| model_type / architectures | Implementation class to load |
| hidden_size | Width of the internal token representation |
| num_hidden_layers | Number of blocks |
| intermediate_size | Feed-forward expansion width |
| num_attention_heads / num_key_value_heads | Attention and GQA structure |
| num_experts / num_experts_per_tok | Available and selected experts |
| layer_types | Hybrid block schedule, if exposed |
| vocab_size / tie_word_embeddings | Token table size and weight sharing |
| max_position_embeddings | Configured positional limit, not a quality guarantee |
| quantization_config | Weight representation and loading requirements |

Field names vary. Inspect the actual module tree before selecting LoRA targets. A load-only smoke test is insufficient: perform a forward pass, backward pass, optimizer step, checkpoint save, and reload. Verify which parameters received gradients.

## 11. Memory and time without false precision

Approximate weight storage is parameters multiplied by bytes per parameter. For a 1.2B model, BF16 weights use roughly 2.4GB; ideal packed four-bit weights use 0.6GB. Quantization metadata, unquantized tensors, and runtime allocations increase those figures.

Training memory includes weights, gradients, optimizer state, activations, temporary buffers, and allocator overhead. Longer sequences and larger microbatches increase activation memory. During inference, the KV cache grows with sequence length and concurrent requests.

**Gradient accumulation** combines multiple small batches before an update. It helps reach a larger effective batch, but does not shrink the memory required for one sequence. **Gradient checkpointing** recomputes activations during backward propagation to reduce memory. **Offloading** moves state to CPU RAM or disk and can introduce transfer bottlenecks.

For your 24GB RTX 4090, a small-model LoRA pilot is a reasonable starting point. Full training may fit with suitable precision and optimizer choices, but the exact sequence length and implementation decide. A Huginn QLoRA recipe also needs explicit compatibility validation; its earlier estimated fit and speed in this conversation were not measured.

Measure processed training tokens per second, not generation tokens per second:

```text
training seconds = total processed training tokens / measured training tokens per second
GPU cost = elapsed hours × GPU count × price per GPU-hour
```

Count repeat exposure: 50 million dataset tokens over three complete epochs is approximately 150 million processed tokens. Padding and packing can change useful-token throughput. Time evaluations, saving, and data stalls too.

Earlier runtime and rental figures in this conversation were planning scenarios, not validated benchmarks. Do not commit months or a rental budget from those numbers alone. A short representative timing run is enough for an initial estimate; a 100M-token benchmark is not required just to measure speed.

The often-cited 20 training tokens per parameter is an approximate compute-allocation result, not a minimum for intelligence or a training completion test. More high-quality tokens can help a fixed model, with diminishing returns. [Compute-optimal training paper](https://arxiv.org/abs/2203.15556)

## 12. Make a small adaptation experiment informative

Choose one measurable task, such as grounded documentation answers, defensive code-review explanations, or categorizing already-supplied findings. Keep examples and expected outputs explicit.

1. Evaluate the original checkpoint on a held-out set.
2. Separate training and evaluation by source or repository before generating variants.
3. Run a small LoRA pilot using the model's supported training implementation.
4. Compare quality, memory, and throughput against the baseline.
5. Use QLoRA when memory is the constraint; compare quality on the same held-out examples.
6. Consider full tuning only when the experiment gives a reason to spend that extra memory and compute.

Evaluate correct answers, unsupported claims, uncertainty, formatting, and general capability retention. Training loss can improve while useful performance gets worse. A lower refusal rate is not a measure of technical competence.

Oversampling important concepts changes how frequently they appear. Weighting their losses changes their contribution to the update. Both can overfit. Use diverse examples, nearby correct/incorrect comparisons, and held-out concept tests rather than endlessly repeating a few examples.

For reliable access to fresh facts, retrieval can be a better fit than embedding every document into weights. RAG supplies relevant documents at inference time; it does not update the model. RAG and fine-tuning can work together.

## 13. Export and deployment

Keep the base revision, tokenizer, chat template, adapter configuration, training configuration, and evaluation results together. Save resumable optimizer state when you need to continue training; adapter weights alone are not a complete training-resume checkpoint.

Test exports separately. A merged or requantized model can behave differently because of numerical changes or a mismatched template. An adapter trained against one quantized base is not guaranteed to give identical outputs when attached to another representation.

Safetensors stores tensors. GGUF packages model information for compatible runtimes. Neither means “instruct,” “LoRA,” or “intelligent.” Hardware support for inference and support for training are separate capabilities.

## 14. Pocket glossary

| Term | Plain meaning |
|---|---|
| Parameter | A learned number in the network |
| Token | A tokenizer-defined unit, not necessarily a word |
| Epoch | One pass over the selected dataset |
| Step | Usually one optimizer update; check the tool's convention |
| Batch | Examples or tokens processed together |
| Loss | The training objective's error signal |
| Base | A pretrained checkpoint without the named instruction post-training |
| SFT | Supervised fine-tuning on target responses |
| CPT | Continued language-model pretraining |
| PEFT | Methods adapting a limited subset of parameters |
| LoRA | Learned low-rank weight updates |
| QLoRA | LoRA with a quantized frozen base |
| Dense | No sparse expert selection in the compared feed-forward blocks |
| MoE | Routed selection among feed-forward expert networks |
| Active parameters | Parameters involved per token under a stated counting convention |
| Hybrid | A mixture of computation block types; specify which types |
| Distillation | Learning from a teacher's outputs or signals |
| RAG | Retrieving context for a model at inference time |
| Quantization | Representing numbers with fewer bits |

## 15. Self-test

**“I used PEFT instead of LoRA.”** Usually a category error: LoRA is a PEFT method.

**“QLoRA trains every weight at four bits.”** False: the quantized base is normally frozen; adapters are trained at a higher precision.

**“An MoE with 3B active needs the memory of a dense 3B.”** False: total weights and trainable state still matter.

**“LFM is hybrid, so it cannot be dense.”** False: a hybrid backbone can use dense feed-forward layers.

**“Giving a normal model more recurrent loops guarantees better reasoning.”** False: it needs an appropriate architecture and training, and improvements require evaluation.

**“If my adapter changes fewer weights, it cannot learn new information.”** False: adapters can learn new information and behavior, although capacity and reliability are limited.

**“My 1.2B model needs exactly 24B tokens to become smart.”** False: scaling heuristics guide compute allocation; usefulness is measured on the task.

**Final exercise:** Describe your intended model in one sentence containing its exact checkpoint, training objective, update method, precision, and evaluation task. If those five choices are clear, you can discuss a training plan without confusing architecture with adaptation.
