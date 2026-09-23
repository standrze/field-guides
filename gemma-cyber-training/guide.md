---
title: Gemma Training Field Guide
slug: gemma-cyber-training
edition: Tropical
updated: 2026-09-23
description: Cyber domain knowledge, problem-solving habits, and personality through CPT and SFT on rented GPUs.
---

# Gemma Training Field Guide

## 1. Build knowledge, judgment, and voice

You want a model that understands cybersecurity, approaches a problem methodically, and sounds like the assistant you want to work with. Those are three related training goals. Give each one its own data and evaluation criteria.

<ul class="flow"><li><strong>Knowledge</strong><small>Expose the model to accurate domain material. Continued pretraining is one way to adapt its representations.</small></li><li><strong>Approach</strong><small>Demonstrate how to interpret evidence, handle uncertainty, recommend a remedy, and check the result.</small></li><li><strong>Personality</strong><small>Make the desired voice visible in correct answers, disagreements, follow-up questions, and explanations.</small></li></ul>

The main route in this guide is **Gemma 3 27B PT → continued pretraining → supervised fine-tuning → evaluation**. The SFT stage combines domain tasks, problem-solving habits, and personality. Add preference tuning only if it solves a measured remaining problem.

Keep two useful comparisons. First, apply the same SFT data directly to the pretrained model, without CPT, to measure the value of your corpus. Second, adapt Google's instruction model with that SFT data to see whether its existing instruction behavior is a better starting point for your budget. The second comparison evaluates a practical alternative; it does not isolate CPT because the starting models have different training histories.

### What this guide assumes

The examples concern defensive security analysis: reviewing supplied code and configurations, assessing findings, interpreting supplied logs, and planning remediation. The initial workload is text only. Training is on rented NVIDIA GPUs, with Hugging Face libraries and either Runpod Pods or Hugging Face Jobs. No GPU job is launched by reading or using this site.

The proposed pilot sizes and settings are **engineering starting points**, not a published optimal recipe for Gemma cyber training. Source-backed findings, author-reported runs, and illustrative calculations are labeled throughout. Prices were checked on **23 September 2026**, and appear in the final chapters.

### Reading routes

For the complete picture, read in order. For a first experiment, focus on Training stages, SFT examples, Evaluation, and The first experiment. For planning a rental, jump to Runpod, Hugging Face, Real training reports, and Budget calculator. The continuous reading view is available from the sidebar and top bar.

## 2. Understand the training stages

**Pretraining** usually learns next-token prediction over a large corpus. **Continued pretraining**, abbreviated CPT here, resumes that objective from an existing checkpoint. When the new corpus emphasizes a domain, it is also called domain-adaptive pretraining, or DAPT. **SFT** means supervised fine-tuning: learning the desired answer given a prompt or conversation.

“SPT” is not an unambiguous name for the instruction stage. Some authors use it for supervised pretraining or other methods. Check the expanded term, objective, and data format. Even CPT is overloaded in library names; this guide always means continued pretraining when it uses that abbreviation.

| Stage | Example training material | Main purpose | What it does not establish by itself |
|---|---|---|---|
| CPT | Clean security documentation and technical explanations | Adapt language-model predictions to the domain | Reliable instruction following or current factual recall |
| SFT | A supplied configuration, a question, and a checked assessment | Demonstrate task behavior and communication | Correctness on situations absent from evaluation |
| DPO | One prompt with preferred and rejected responses | Adjust relative response preferences | A substitute for accurate supervision |
| Retrieval at inference | Current advisories or internal documents supplied as context | Give the answer fresh, attributable evidence | Permanent learning in the weights |

CPT and SFT both update model behavior. The distinction is not a physical separation between “knowledge weights” and “personality weights.” It is a difference in training signal. SFT can introduce facts; CPT can influence tone. Evaluate all three goals after either stage.

Domain-adaptive pretraining has improved downstream performance in research, but results depend on model, corpus, and task. The original *Don't Stop Pretraining* study involved earlier language models and classification tasks; it is evidence for the approach, not a Gemma 27B cost or quality guarantee. [Gururangan et al., 2020](https://aclanthology.org/2020.acl-main.740/)

### CPT versus a current reference library

Train durable concepts: trust boundaries, authentication versus authorization, log interpretation, secure design, and careful analysis. Keep rapidly changing facts such as affected versions and newly published advisories available through a dated reference library. A model's fluent recollection is not a dependable replacement for checking the current vendor notice.

### Optional preference tuning

DPO learns from a preferred answer and a rejected answer for the same prompt, without a separate learned reward model. It is useful when both answers are plausible but one better follows your evidence or communication standard. Start with successful SFT before spending on this extra stage. [TRL DPO documentation](https://huggingface.co/docs/trl/dpo_trainer)

## 3. Choose the right Gemma checkpoint

Use **`google/gemma-3-27b-pt`** for your requested pretrained starting point. The **`google/gemma-3-27b-it`** checkpoint already has Google's instruction tuning. Both belong to the Gemma 3 family; the 27B model accepts text and images and supports a 128K context window. Hugging Face access requires accepting the Gemma conditions. [Official PT model card](https://huggingface.co/google/gemma-3-27b-pt)

| Starting point | Why choose it? | Additional work |
|---|---|---|
| 27B PT | You want a controlled domain-adaptation and post-training sequence | Your SFT must supply adequate general instruction behavior as well as specialist tasks |
| 27B IT | You want to build on an existing assistant | Check that adaptation preserves its useful behavior |
| A smaller Gemma 3 model | You want to debug data and the training pipeline cheaply | Re-measure memory, throughput, and quality on 27B before budgeting production training |

A few thousand narrow examples can shape an existing assistant. They are a much thinner substitute for the broad post-training that created Google's IT model. The Gemma 3 technical report describes a substantial post-training recipe including distillation and reinforcement learning. A small custom SFT run should not be expected to reproduce it. [Gemma 3 technical report](https://arxiv.org/abs/2503.19786)

### The multimodal detail matters

Gemma 3 27B is not interchangeable with every text-only causal language model in a generic tutorial. Use a trainer that explicitly supports its architecture. Keep the vision components frozen for a text-only experiment and inspect exactly which language modules receive adapters. An unqualified “all linear layers” target can match more than you intended.

The Transformers documentation exposes both conditional-generation and text-model classes. Loading or extracting the text model requires matching the checkpoint layout and configuration; changing a class name in an unrelated script is not enough. [Transformers Gemma 3 documentation](https://huggingface.co/docs/transformers/model_doc/gemma3)

### Context and formatting

Start around 2,048–4,096 tokens if your examples fit. The advertised 128K capacity does not make training at 128K affordable. Long sequences increase activation memory and compute, and a short-context fine-tune does not verify retained long-context quality.

For SFT, use a consistent chat template and save it with the final model. Gemma's native dialogue uses user and model turns. A library may accept an `assistant` role in a messages record and translate it into the native model turn. Handle system instructions through the actual template; do not invent a raw system turn. [Google's formatting guide](https://ai.google.dev/gemma/docs/core/prompt-structure)

## 4. Build a useful cyber corpus

Begin with a coverage map. Decide which questions your model must handle: secure application design, authentication and authorization, cloud configuration, defensive incident analysis, vulnerability prioritization, or remediation review. “Cybersecurity” is too broad to treat as one uniform dataset.

| Material | Useful training purpose | Preparation |
|---|---|---|
| Official product security documentation | Correct platform terminology and configuration meaning | Preserve product, version, date, and section context |
| Secure development standards | Requirements, design principles, and review criteria | Keep identifiers attached to their explanations |
| Reviewed incident reports | Evidence, uncertainty, response decisions, and lessons | Remove sensitive operational and personal data |
| Remediation notes and patch explanations | Why a change addresses a failure mode | Retain assumptions and verification results |
| General technical prose and code explanations | Maintain broader language and technical competence | Match quality and licensing to the specialist corpus |

NIST SP 800-61 Rev. 3 provides current incident-response risk-management framing. OWASP ASVS supplies application security verification requirements. These are useful reference starting points, but publication on the web does not itself establish permission to redistribute an entire corpus. [NIST SP 800-61r3](https://csrc.nist.gov/pubs/sp/800/61/r3/final), [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/)

### Prepare documents before counting tokens

Extract readable text. Remove navigation menus, repeated footers, duplicate pages, broken OCR, and low-information boilerplate. Retain code indentation and the relationship between headings and their content. A million tokens of navigation links is a million tokens of training expense with little useful supervision.

Store provenance separately from the training text: source URL, retrieval date, version, license or permission, document ID, quality review, and split assignment. Keep immutable raw and cleaned copies so a later mistake can be traced to its source.

Split by **document, repository, incident, or source family before chunking**. Otherwise different excerpts of the same incident can end up in training and evaluation. Remove near duplicates across splits, including paraphrased synthetic derivatives.

### A starting mixture to test

An illustrative CPT pilot might allocate **80% domain text and 20% broad technical/general text by tokens**. That is a tunable experiment, not a universal preservation ratio. Evaluate whether the replay material helps your model retain useful skills. Continual-pretraining research supports examining replay and learning-rate schedules, but its results do not establish this particular mixture for Gemma. [Simple and Scalable Strategies to Continually Pre-train LLMs](https://arxiv.org/abs/2403.08763)

Do not keep feeding raw documents merely because domain loss falls. The final test is whether the subsequently instruction-tuned model handles unseen domain tasks better.

## 5. Teach the approach with SFT examples

CPT gives domain exposure. SFT shows how to use it when someone brings a problem. Construct examples in which the assistant distinguishes supplied evidence from assumptions, explains a defensible assessment, and recommends a concrete next step.

| Task family | Input | Desired response behavior |
|---|---|---|
| Finding triage | A finding plus the relevant context | Decide what the evidence supports and what is still missing |
| Secure code review | A supplied code excerpt and requirements | Explain the concern and a safer implementation or design |
| Configuration assessment | Relevant settings and intended behavior | Connect a setting to its consequence and remediation |
| Incident interpretation | Sanitized logs and a timeline | Distinguish an observation, a hypothesis, and a confirmed event |
| Fix review | A proposed remediation and checks | Assess whether the change addresses the cause and how to verify it |

### A small worked example

This fictional record teaches analysis without making a premature claim about compromise:

```json
{
  "messages": [
    {
      "role": "user",
      "content": "Our supplied log summary shows 80 failed sign-ins followed by one successful sign-in. Does this prove the account was compromised?"
    },
    {
      "role": "assistant",
      "content": "It is suspicious, but this summary alone does not prove compromise. The successful sign-in could be related to the failures or could be the legitimate user. Check the account, timestamps, authentication result details, MFA event, and subsequent session activity in the available records. If the activity is unauthorized, follow the account-containment procedure and preserve the relevant logs. The assessment should state which evidence confirmed or ruled out that explanation."
    }
  ]
}
```

This is a readable JSON record. A JSONL dataset stores each complete record on one line. Keep the source metadata outside the messages unless the model needs it as answer context.

### Teach explanations that can be checked

Provide concise rationales grounded in the input: which observation mattered, what inference is justified, and what would change the conclusion. Long generated reasoning is not automatically accurate supervision. Have a reviewer check the answer's claims and the proposed verification, not just its confident tone.

Include ordinary cases, ambiguous cases, false alarms, incomplete evidence, corrected assumptions, and multi-turn follow-ups. If every example ends with a severe finding, you teach the model to find one everywhere. If every answer uses five headings, you teach a formatting habit that may overwhelm simple questions.

For a first 5,000-example pilot, an **illustrative allocation by examples** is 3,000 task cases, 1,000 ambiguity/correction cases, and 1,000 broad instruction or conversation cases. Embed the desired voice across all groups. Broader base-to-instruct training may need considerably more instruction diversity.

### Avoid an invisible loss-mask mistake

Conversation SFT commonly supervises assistant responses. TRL's `assistant_only_loss` needs a compatible chat template with generation markers; inspect the actual mask instead of assuming the flag works with every Gemma template. Check that answers survive truncation and that appropriate end-of-turn tokens are learned. [TRL SFTTrainer](https://huggingface.co/docs/trl/sft_trainer)

## 6. Train a personality that stays useful

A trainable personality is a collection of observable habits. Define what it looks like when the assistant explains a concept, disagrees, admits uncertainty, asks for missing evidence, and helps someone recover from a mistake.

Here is an editable example specification for a calm, direct technical assistant.

| Trait | Show it in the data | Watch for this failure |
|---|---|---|
| Direct | Lead with the assessment or answer | Overstating certainty to sound decisive |
| Curious | Ask a relevant question when evidence is missing | Asking unnecessary questions in every response |
| Calm | Describe risk proportionately | Downplaying a serious, well-supported issue |
| Warm | Acknowledge the person's situation naturally | Repetitive praise or catchphrases |
| Skeptical | Correct a mistaken premise courteously | Habitual disagreement without evidence |
| Practical | Explain the remedy and its verification | Inventing actions or results that never occurred |

### Demonstrate the voice while doing the task

Start from a technically correct answer. Rewrite it in the desired voice while preserving the facts, uncertainty, recommendation, and conclusion. Review the pair. If the “confident” rewrite silently converts a possibility into a certainty, reject it.

For a default personality, include examples where the assistant expresses the voice without a repeated persona instruction. For switchable personalities, use consistent conditioning or separate tested adapters. A persona used only in training prompts can become a dependency: the behavior may weaken when that prompt disappears at inference.

### Can personality change without changing knowledge?

It can change while many capabilities remain useful, but there is no guarantee of a clean separation. LoRA freezes the original parameters and adds an update; the active model's outputs still change. Disabling an unmerged adapter restores the base behavior, whereas keeping it active may alter factual recall, judgment, or instruction following.

Research comparing LoRA and full tuning found preservation/learning tradeoffs on mathematics and programming tasks. That supports measuring both adaptation and retained ability, not assuming frozen weights imply unchanged knowledge. [LoRA Learns Less and Forgets Less](https://arxiv.org/abs/2405.09673)

### Separate personality pass or one SFT mixture?

Start with one SFT mixture that demonstrates the desired style during the actual domain tasks. A later personality-only pass is another intervention and can weaken the earlier task behavior. Use it when your evaluation shows the domain work is good but the voice remains inconsistent; retain task examples during that pass and compare checkpoints.

For preference data, compare answers of similar factual quality. Reward the version that handles uncertainty or communication better. If every preferred response is longer, you may mostly teach verbosity. See Real training reports for Gemma-specific personality and writing-style experiments.

## 7. Decide how much data to use

Count tokens with the **actual Gemma tokenizer** after cleaning and formatting. Pages, PDF size, and gigabytes are poor training-budget units. Code, tables, identifiers, and multilingual text can tokenize very differently from ordinary English.

| Experiment | Suggested initial scale | Meaning |
|---|---|---|
| Pipeline smoke test | A few hundred records or a short fixed step budget | Check loading, masks, checkpoints, and loss behavior |
| CPT pilot | 10–100 million unique cleaned tokens | Test whether this corpus helps; not a threshold for expertise |
| Focused SFT pilot | 1,000–5,000 reviewed examples | Find data and behavior problems early |
| Expanded SFT | 10,000–50,000 diverse examples if justified | Cover missing tasks, environments, and dialogue situations |
| Larger CPT | Hundreds of millions or billions of tokens | Consider only after useful gains and a measured cost model |

These are planning ranges for your experiments. They are not claims about the minimum data needed to create a general assistant from Gemma PT. The narrow pilot is especially useful when comparing against an already instruction-tuned model.

LIMA demonstrated strong instruction adaptation using 1,000 carefully curated examples on a different model. It supports investing in quality and coverage, but it does not establish that 1,000 examples will teach a broad cyber specialty or recreate Gemma's post-training. [LIMA](https://arxiv.org/abs/2305.11206)

### Unique tokens and tokens seen are different

Suppose your CPT corpus contains 50 million unique tokens. Two passes process approximately 100 million tokens. The second pass increases exposure, not information diversity. Ten thousand superficial rewrites of the same explanation are also not equivalent to ten thousand distinct situations.

For SFT, distinguish **input tokens processed** from **tokens that receive loss**. A 3,000-token prompt with a 300-token answer still requires computation over the prompt, even if only the answer is supervised. Do not estimate rental time using the 300-token answer alone.

An example budget: 5,000 conversations averaging 1,500 formatted tokens equal 7.5 million input tokens per epoch. Two epochs are approximately 15 million processed tokens before padding or packing effects. Measure the real token counts rather than using this average as a model benchmark.

### Spend data effort where errors cluster

After each pilot, label failures by category. Add examples for missing concepts, ambiguity handling, format compliance, or poor explanations. If the model is wrong about facts, a larger style dataset will not address that gap. If it knows the facts but jumps to conclusions, add checked task demonstrations rather than more encyclopedia text.

## 8. Epochs, steps, and repeated rounds

An **epoch** is one pass over the dataset. A **microbatch** is what each GPU processes at once. **Gradient accumulation** combines several microbatches before one optimizer update. A **step** usually means that optimizer update, but logs can use the word differently. A **checkpoint** is a saved state. A **run** is one configured experiment.

For ordinary data-parallel training, the approximate effective batch is:

```text
effective batch = microbatch per GPU × GPU count × accumulation steps
steps per epoch ≈ number of training sequences / effective batch
```

With 10,000 sequences, one GPU, microbatch 1, and accumulation 16, you get roughly 625 updates per epoch. Two GPUs with the same settings yield effective batch 32 and roughly 313 updates. This arithmetic does not describe tensor parallelism, where multiple GPUs cooperate on the same model replica. Packing and partial final batches also change exact counts.

### What more epochs change

More epochs can strengthen a useful pattern and can also overfit wording, repeat mistakes, or erode other capabilities. A tiny dataset repeated many times does not become a broad dataset. Training loss can keep improving while unseen task quality gets worse.

For the pilot, start with approximately **one CPT pass** and **one SFT epoch**, saving intermediate checkpoints. Consider a second SFT epoch only if task evaluation supports it. These are conservative experiment choices, not a law; published projects use many different schedules.

### What more rounds change

If “round two” restarts from the first round's final checkpoint, it is additional exposure and adaptation. If it restarts from the original model with different settings, it is a comparison run. Record which you mean.

Alternating CPT and SFT is possible, but fresh raw-text CPT after SFT can change the assistant behavior you just taught. Re-evaluate the instruction stage after any new CPT stage. Keep the earlier checkpoints so you can identify where a regression appeared.

### Resume versus start a new stage

Resume an interrupted run with its optimizer, scheduler, random state, and data position when supported. Start SFT as a new stage with the selected CPT weights or adapter state and a new training schedule. An adapter export is enough for inference with its base, but generally not enough to resume the same optimization trajectory.

Schedule evaluations by a useful fraction of the planned token budget. For a short pilot, checks around 25%, 50%, 75%, and completion are a simple starting point. Excessively frequent full evaluations can cost more than the training they are monitoring.

## 9. Understand the main training controls

Tune a few controls deliberately. A configuration copied from a different model, task, or hardware setup is a hypothesis to test.

| Control | What it changes | Pilot guidance |
|---|---|---|
| Learning rate | Size of updates | Too high can destabilize behavior; too low can produce little adaptation |
| Sequence length | How much context an example can retain | Choose from your length distribution and inspect truncated answers |
| Effective batch | Examples contributing to each update | Track both examples and tokens per update |
| LoRA rank | Capacity of adapter updates | Compare a small number of ranks only when needed |
| Warmup and decay | How the learning rate changes during the run | Avoid abruptly applying a large learning rate to a pretrained model |
| Gradient clipping | Limits unusually large gradient norms | Monitor clipping frequency alongside loss and task quality |
| Packing | Uses space that would otherwise be padding | Confirm document boundaries, masks, and implementation behavior |
| Gradient checkpointing | Recomputes activations to save memory | Usually trades extra compute for lower memory use |

### Example starting configuration, not a proven optimum

For **adapter SFT**, compare learning rates such as `5e-5` and `1e-4`, rank 16 or 32, one epoch, and 2,048–4,096-token sequences. Start microbatch at 1, then choose accumulation to reach a useful batch for the dataset. Consider warmup around 3–5% of updates and gradient clipping at 1.0. These values are an experimental starting range; do not grid-search every combination on rented GPUs.

For **adapter CPT**, try a conservative learning rate such as `2e-5` to `5e-5` and inspect both domain loss and retained behavior after downstream SFT. For **full-weight adaptation**, learning rates often need a different, lower search range; an illustrative first comparison is `5e-6` versus `1e-5`. These CPT and full-tuning values are authoring recommendations, not findings from a Gemma 27B cyber benchmark.

Published work on learning-rate rewarming shows that schedule choices affect continual pretraining. Its experiments used a smaller Pythia model and different corpora, so use the paper to understand the mechanism rather than import its values unchanged. [How to (re)warm your model?](https://arxiv.org/abs/2308.04014)

### Avoid changing everything at once

First get one correct baseline. If quality is weak, inspect the data and the supervised tokens before increasing rank, epochs, context, and learning rate together. If a run improves, you want to know which change earned the cost.

Do not treat an inference example using `device_map="auto"` as a multi-GPU training recipe. Use the trainer's supported distributed strategy. Likewise, a four-bit model format intended for local serving is not automatically a supported QLoRA training checkpoint.

## 10. Choose full tuning, LoRA, or QLoRA

**Full tuning** changes the selected original weights. **LoRA** freezes them and learns low-rank updates. **QLoRA** trains those updates while holding the base in a quantized representation. CPT and SFT are learning objectives; all three update methods can be considered independently of those objectives.

| Method | Why use it? | Main constraint for 27B |
|---|---|---|
| BF16 full tuning | Broad freedom to change representations | Very large training state and distributed setup |
| BF16 LoRA | Adapter experiment without a four-bit base | About 54 GB for nominal base weights before anything else |
| QLoRA | Affordable adapter experiments on one large GPU | Real memory and speed depend strongly on kernels, lengths, and targets |

### Memory arithmetic

Using 27 billion parameters as a rounded accounting figure:

```text
BF16 weight payload: 27 billion × 2 bytes = 54 GB
Ideal four-bit payload: 27 billion × 0.5 bytes = 13.5 GB
Example full Adam training state: 27 billion × 18 bytes = 486 GB
```

Those are decimal GB. The four-bit figure excludes quantization metadata, modules retained at higher precision, adapters, gradients, optimizer state, activations, and temporary buffers. The full-state example uses a conventional mixed-precision Adam layout with a master copy and FP32 gradients/moments; other implementations differ. The model's exact trainable parameter count also matters. [Hugging Face memory anatomy](https://huggingface.co/docs/transformers/main/en/model_memory_anatomy)

**Four 80 GB GPUs do not automatically fit full training.** Sharding divides some state across devices, but ordinary data parallelism replicates it. Eight 80 GB GPUs offer more aggregate capacity; fit still depends on activations, sharding overhead, offload, and context. Price the actual supported configuration.

### A practical rental choice

A 48 GB GPU can be useful for a supported short-context QLoRA setup. An 80 or 96 GB GPU offers more room for a first 27B experiment. A 24 GB optimized implementation can work under specific conditions, but it is a tight target for a generic recipe. Unsloth reports Gemma 3 27B fine-tuning below 22 GB in its optimized path; that is a vendor implementation claim, not a guarantee for your data or trainer. [Unsloth Gemma 3 announcement](https://unsloth.ai/blog/gemma3)

For bitsandbytes-based QLoRA, NF4, double quantization, and BF16 computation are standard supported configuration options. Use the required preparation for quantized training before attaching adapters, and inspect trainable module names. [PEFT quantization guide](https://huggingface.co/docs/peft/developer_guides/quantization)

### Carry CPT into SFT correctly

If CPT used an adapter, starting SFT from the original base with a fresh adapter loses that adaptation. You can continue training the CPT adapter on SFT, or merge the selected CPT update into a compatible higher-precision base and train a new SFT adapter against that exact derived checkpoint. Record the choice. Do not assume independently trained adapters can be added together without evaluation. [PEFT LoRA reference](https://huggingface.co/docs/peft/package_reference/lora)

## 11. Evaluate the model you actually want

Build evaluation before scaling training. Separate knowledge, approach, personality, and retained capability so an improvement in one does not hide a regression in another.

| Axis | What to check | Failure to catch |
|---|---|---|
| Domain knowledge | Correct concepts, version-sensitive claims, source-grounded answers | Fluent but outdated or invented facts |
| Approach | Evidence versus inference, uncertainty, sound remediation, meaningful verification | Jumping from a weak signal to a strong conclusion |
| Personality | Clarity, warmth, appropriate disagreement, consistency | Catchphrases or confident errors |
| General ability | Summarization, instructions, ordinary questions, structured output | Narrow specialization that harms basic usefulness |
| Conversation | Follow-ups, corrections, changing evidence | Repeating an earlier conclusion after new information |
| Deployment | Same prompts on the exported serving model | Quality loss from an incorrect template or conversion |

### A manageable first set

An illustrative pilot evaluation could contain 100 domain cases, 50 uncertainty or false-premise cases, 50 general tasks, and 25 multi-turn conversations. Keep it small enough to review carefully. These counts are a practical starting point, not statistically sufficient proof of broad reliability.

Hold out entire source families, incidents, and scenarios. Use a development set for checkpoint selection and a final untouched test set for the reported result. If you repeatedly inspect the same test answers while editing training data, that set becomes development data.

### Score the answer, not its polish

For each case, mark factual correctness, use of supplied evidence, unjustified claims, remedy quality, and communication. A wrong but elegant response should fail the task-quality criterion. Use blinded A/B comparisons with answer order randomized. An LLM judge can help screen answers, but calibrate its judgments against a human sample and inspect disagreements.

Use automatic checks where the requirement is exact: valid JSON, required fields, citations to supplied documents, or a stated schema. For descriptive judgments, save the rubric, reference evidence, model output, and reviewer decision.

### Choose a checkpoint on several signals

Validation loss is useful but incomplete. Lower CPT loss measures prediction of held-out domain text, not instruction quality. Lower SFT loss does not prove better judgment. Select checkpoints using both loss and the tasks you care about, with a predefined tolerance for general-capability regressions.

For example, “domain task correctness improves and no material general-task regression appears under blinded review” is a useful direction. Define what “material” means before the run; a handful of prompts cannot resolve small percentage differences reliably.

## 12. Run the first experiment

The initial goal is to discover whether your data and training sequence improve a model you would actually use. Begin with a limited token budget and a clean comparison.

| Run | Starting state | Training | What it answers |
|---|---|---|---|
| A | Gemma 3 27B IT | None | What does the existing assistant already do? |
| B | Gemma 3 27B IT | Domain/process/personality SFT | How far does a modest adaptation of an assistant get? |
| C | Gemma 3 27B PT | The same SFT mixture | How does your instruction data perform on the base? |
| D | Gemma 3 27B PT | CPT, then the same SFT mixture | Does this CPT stage add value relative to C? |

For the tightest budget, run A and B first while preparing C and D. If your requirement is specifically a base-origin model, C and D remain the central comparison. Keep SFT settings matched between C and D where feasible, record total compute, and remember that D intentionally has extra training.

### Sequence of work

1. Freeze a versioned dataset and evaluation split. Count formatted tokens and inspect representative long examples.
2. Pin a compatible training environment, exact model revision, tokenizer, and template.
3. Run a small smoke test. Inspect trainable parameters, sample loss masks, memory, and an exported/reloaded sample.
4. Benchmark steady-state training after warmup. Include enough updates to see realistic throughput and record checkpoint/evaluation overhead separately.
5. Run the planned token budget and save intermediate states.
6. Evaluate, choose a checkpoint, and document both gains and regressions.
7. Expand the data or change one setting in response to a specific failure.

### A run manifest worth keeping

```yaml
run_name: gemma-cyber-pilot-d
base_model: google/gemma-3-27b-pt
base_revision: RECORD_EXACT_COMMIT
objective: cpt_then_sft
update_method: qlora
dataset_revision: RECORD_DATASET_COMMIT
evaluation_revision: RECORD_EVAL_COMMIT
context_tokens: 2048
seed: 42
software_lock: requirements-lock.txt
checkpoint_policy: intermediate_and_final
```

This is a documentation example, not a trainer's configuration schema. Add the actual optimizer, learning rate, LoRA targets/rank, batching, token count, GPU type/count, throughput, wall time, and cost once known.

The first technical success is a reproducible training and reload cycle. The first model success is a measured improvement on unseen tasks. Treat them as separate milestones.

## 13. Use Runpod for rented GPU training

For these experiments, choose a **Pod**: a rented GPU machine that can run a long training process. Compare GPUs using the completed job cost once you have measured throughput. The lowest hourly rate need not be the cheapest way to process your corpus.

### Before launch

Choose GPU memory, system RAM, disk capacity, and an image compatible with your CUDA/PyTorch stack. Make sure the trainer supports Gemma 3 and your selected precision. Keep dependency versions in a lock file after a successful smoke test. Review the actual cloud type, region, availability, and whole-instance price in the launch screen.

### Put outputs on persistent storage

Runpod distinguishes container disk, volume disk, and network volumes. Container storage is temporary. A Pod's volume can survive stopping but is deleted with the Pod; an independent network volume can outlive it. Check the chosen mount and lifecycle rather than assuming every `/workspace` directory is durable. [Runpod storage types](https://docs.runpod.io/pods/storage/types)

For a Pod with persistent storage mounted at `/workspace`, a useful directory plan is:

```text
/workspace/
  hf-cache/
  training-project/
  datasets/
  checkpoints/
  exports/
  evaluation/
```

Set the model cache there so a new process does not repeatedly download tens of gigabytes. Use a scoped token for gated model access and private uploads; keep its value out of code and logs.

```bash
# Run inside the Pod after verifying /workspace is persistent.
export HF_HOME=/workspace/hf-cache
hf auth login
nvidia-smi
```

### Launch, monitor, and recover

The actual training command belongs to the trainer you chose. A command such as `python train.py --config cpt.yaml` is only a shell pattern until those files exist and have passed a smoke test. Google links supported Gemma tuning frameworks from its tuning guide; choose a Gemma-compatible implementation, then apply the data and experiment design in this field guide. [Google tuning entry point](https://ai.google.dev/gemma/docs/tune)

Use a persistent terminal session or job launcher so disconnecting the browser does not end your work. Record loss, gradients, GPU memory, token throughput, and evaluation results. Save a resumable checkpoint to persistent storage and verify that a new process can reload it before starting a long rental.

After the run, upload the selected export and copy the training records. Verify the remote files before terminating the Pod. Disconnecting your SSH session does not stop the GPU bill. Stopping compute can leave storage charges; deletion has different consequences for the volume types.

## 14. Use Hugging Face tools and Jobs

Hugging Face supplies both software and hosting. Its libraries can run on a Runpod machine; **Hugging Face Jobs** is an alternative compute service. The Hub stores models and datasets. These are complementary roles, so using Runpod does not require abandoning the Hugging Face workflow.

| Component | Role in your project |
|---|---|
| Transformers | Model loading, tokenizer/processor, architecture support |
| Datasets | Versioned examples and preprocessing |
| PEFT | LoRA and quantized adapter training support |
| TRL | SFT and preference training interfaces |
| Accelerate / supported distributed backend | Device placement and distributed training |
| Hub and storage buckets | Model exports, datasets, and training artifacts |
| Jobs | Rented compute that executes your script or container |

### Set up a Job

Jobs currently requires a positive credit balance and bills starting/running time by the minute. Check available hardware and set an explicit timeout; the documented default is 30 minutes. [Jobs pricing and billing](https://huggingface.co/docs/hub/jobs-pricing)

The following is a **launch template** for your own implemented, dependency-declared `train.py` UV script. It is not a complete trainer. Replace `USERNAME` and the job identifier, and make sure the script accepts the shown `--output_dir` argument.

```bash
hf auth login
hf jobs hardware
hf buckets create gemma-checkpoints --private

hf jobs uv run \
  --flavor a100-large \
  --timeout 8h \
  --secrets HF_TOKEN \
  -v hf://buckets/USERNAME/gemma-checkpoints:/outputs \
  train.py --output_dir /outputs/cyber-pilot

hf jobs logs JOB_ID
hf jobs inspect JOB_ID
hf jobs cancel JOB_ID
```

Use a recent compatible Hub CLI. The secret option forwards an available token without putting its value in the command. Current Jobs supports writable bucket mounts for outputs; model and dataset repository mounts are read-only. Confirm the mounted output path in your script. [HF CLI guide](https://huggingface.co/docs/huggingface_hub/main/en/guides/cli), [HF Jobs guide](https://huggingface.co/docs/huggingface_hub/main/en/guides/jobs)

**Ctrl+C while streaming logs does not cancel the remote job.** Use the cancellation command or the Jobs interface when you want compute to stop. [Jobs quickstart](https://huggingface.co/docs/hub/jobs-quickstart)

### Configure the objective explicitly

For CPT, use cleaned text with a causal language-model objective and the intended document boundaries. For SFT, use correctly rendered prompt/answer or conversation records with the intended response loss. Check truncation and packing before scaling. The same trainer class can support different dataset forms; its name alone does not establish which tokens you trained on.

Pin the working software environment and keep one known-good example batch. When upgrading a library, rerun formatting, masking, load, and export checks before paying for another long run.

## 15. Export and keep the training lineage

Save both the selected inference artifact and enough information to reproduce it. An adapter requires its exact base. A merged checkpoint still requires the matching tokenizer, configuration, and chat template.

| Artifact | Recommended location | Why keep it? |
|---|---|---|
| Guide, code, configurations, evaluation summaries | GitHub | Readable history and review |
| Adapter or full model export | Hugging Face model repository | Appropriate model distribution and versioning |
| Resumable training checkpoints | Private persistent storage or bucket | Recovery with optimizer and scheduler state |
| Dataset version and provenance | Controlled dataset repository/storage | Reproducibility and source traceability |
| Private incident examples or internal logs | Access-controlled storage | Keep sensitive training inputs separate from public documentation |

The GitHub upload for this project is the **field guide**, not trained weights. A 27B model's large tensors belong in model storage; a small source repository can describe exactly where to load the tested artifact.

### Stage lineage

```text
Original Gemma revision
  → selected CPT state
  → selected SFT state
  → optional preference-tuned state
  → tested inference export
```

If the SFT adapter was trained against a CPT-merged model, its base is that derived model. Loading it against the untouched Google checkpoint changes the computation. Preserve enough provenance to reconstruct every arrow.

Keep adapters unmerged while comparing experiments. For a merge, use a supported higher-precision base and the correct adapter, then evaluate the merged result. If you subsequently quantize for serving, evaluate again: merging and quantization can alter outputs. [PEFT model merging](https://huggingface.co/docs/peft/developer_guides/model_merging)

### Minimal model card

Describe the base revision, task scope, data composition and exclusions, training method/settings, hardware and duration, evaluation design, results and known weaknesses, required template, and applicable model terms. Report actual observed cost separately from a projected rental price.

Run a small fixed prompt set through the training environment and the deployed runtime. Look for answer truncation, missing turn endings, role leakage, unexpected template text, and changes in factual or structured output. A successful file conversion is not sufficient evidence of serving parity.

## 16. What other Gemma trainers reported

There are useful firsthand accounts, but they cover different objectives and scales. I did not find a fully comparable public account with an itemized bill for **Gemma 3 27B cyber CPT → process/personality SFT**. The cases below give narrower evidence. Reported times are the authors' results, not independently reproduced measurements for this guide.

### Antislop: change the writing style of 27B

The Antislop authors report **6.8 hours on one H100**, using **68 GB VRAM**, for the 27B training stage with **10,000 preference samples** and final-token preference optimization. Their **approximately $13.30** figure is an estimated historical compute cost, not an invoice. The author's model card identifies the base as Gemma 3 27B IT. This is directly relevant evidence that writing habits can be changed through training, but it is not a CPT experiment. [Published paper, Appendix B.1](https://openreview.net/pdf/6916f45661bf884811be66da937b7467b97a9114.pdf), [author's model card](https://huggingface.co/sam-paech/gemma-3-27b-it-antislop)

The cost table was available through the primary paper's search index when direct PDF access presented a browser check. The older arXiv version does not contain that final cost table. Keep the published-paper reference when verifying the numbers.

### Persona Cartography: a Gemma personality adapter

This July 2026 preprint includes Gemma 3 27B IT personality adaptation using a DPO/SFT pipeline. Appendix A.1.4 reports **under 12 hours for the single-trait training pipeline on an A100 rented from Runpod**. It does not state an itemized dollar bill or the A100 memory variant in that passage. The paper reports stronger capability tradeoffs at extreme adapter scales; its deepest evaluations focus on Llama 8B, with a smaller set on Gemma. This supports testing personality and capability separately. [Persona Cartography](https://arxiv.org/html/2607.07916v1#A1.SS1.SSS4)

### Forge: a short 27B QLoRA run and useful mistakes

The Forge model card reports Gemma 3 27B IT QLoRA training for **3 hours 48 minutes on one H100 80 GB SXM**, using rank 16, 2,048-token sequences, 1,000 steps, and effective batch 16. It discloses no rental bill. This is a community author's account, and the stated sample/epoch figures are not fully consistent, so use the reported duration cautiously. More useful than the headline benchmark are the disclosed data-ingestion issues, benchmark overlap, and weaker open-ended conversation. These illustrate why checking the actual dataset and retained capability matters. [Author's model card](https://huggingface.co/KK9922/Forge-Gemma-3-27B-GGUF)

### GaMS3: substantial CPT followed by SFT

The University of Ljubljana's GaMS3 project adapted **Gemma 3 12B**, using three CPT stages followed by two SFT stages, about **140 billion pretraining tokens**, and over **200,000 SFT examples**. The paper reports roughly **140,000 A100 GPU-hours**, plus B200 and H100 work; its separate H200 allocation should not be counted as consumed time. No retail bill is given. Each CPT stage used one epoch; the SFT stages ran three, but validation selected the second-epoch checkpoints. It is a useful example of staged adaptation and checkpoint choice at a vastly larger scale than a rental pilot. [GaMS3 paper](https://arxiv.org/html/2603.01691v1)

### What to take from these accounts

Short adapter runs can be affordable. Large-scale CPT can consume orders of magnitude more compute. The words “fine-tuned Gemma” do not tell you which situation applies. Always ask for model size, starting checkpoint, objective, total processed tokens, sequence length, update method, hardware, and whether the reported time includes generation and evaluation. The final cost chapter reprices a few reported runtimes at today's rates, explicitly as calculations.

## 17. Sources and evidence notes

Research checked **23 September 2026**. The links below are model publishers, library maintainers, research authors, standards bodies, or the GPU providers. Recommendations about your pilot are this guide's synthesis and should be tested on your data.

### Model and implementation

- [Google Gemma 3 27B PT](https://huggingface.co/google/gemma-3-27b-pt): checkpoint identity and access conditions.
- [Gemma 3 technical report](https://arxiv.org/abs/2503.19786): architecture and original training context.
- [Transformers Gemma 3](https://huggingface.co/docs/transformers/model_doc/gemma3): supported model classes.
- [Google Gemma formatting](https://ai.google.dev/gemma/docs/core/prompt-structure): native turn format.
- [Google tuning guide](https://ai.google.dev/gemma/docs/tune): supported framework entry points.
- [TRL SFTTrainer](https://huggingface.co/docs/trl/sft_trainer) and [DPOTrainer](https://huggingface.co/docs/trl/dpo_trainer): data interfaces and loss options.
- [PEFT quantization](https://huggingface.co/docs/peft/developer_guides/quantization), [LoRA](https://huggingface.co/docs/peft/package_reference/lora), and [merging](https://huggingface.co/docs/peft/developer_guides/model_merging): adapter mechanics.
- [Memory anatomy](https://huggingface.co/docs/transformers/main/en/model_memory_anatomy): components of training memory.
- [Unsloth's Gemma 3 report](https://unsloth.ai/blog/gemma3): implementation-specific memory claims, not a universal fit promise.

### Training research and actual runs

- [Don't Stop Pretraining](https://aclanthology.org/2020.acl-main.740/): earlier domain-adaptation evidence.
- [Continual pretraining strategies](https://arxiv.org/abs/2403.08763): replay and learning-rate scheduling.
- [Learning-rate rewarming](https://arxiv.org/abs/2308.04014): schedule experiments on a different model family.
- [LIMA](https://arxiv.org/abs/2305.11206): curated instruction data at small example counts.
- [LoRA Learns Less and Forgets Less](https://arxiv.org/abs/2405.09673): adaptation versus preservation tradeoffs.
- [Antislop final paper](https://openreview.net/pdf/6916f45661bf884811be66da937b7467b97a9114.pdf): reported 27B runtime and estimated historical cost.
- [Persona Cartography](https://arxiv.org/html/2607.07916v1): personality adaptation and capability measurements.
- [Forge model card](https://huggingface.co/KK9922/Forge-Gemma-3-27B-GGUF): community run report and limitations.
- [GaMS3](https://arxiv.org/html/2603.01691v1): large Gemma 3 CPT → SFT project.

### Domain and operations references

- [NIST SP 800-61r3](https://csrc.nist.gov/pubs/sp/800/61/r3/final) and [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/): defensive domain references.
- [Runpod storage](https://docs.runpod.io/pods/storage/types) and [pricing](https://www.runpod.io/pricing): current storage and rental details.
- [HF Jobs guide](https://huggingface.co/docs/huggingface_hub/main/en/guides/jobs), [CLI](https://huggingface.co/docs/huggingface_hub/main/en/guides/cli), [quickstart](https://huggingface.co/docs/hub/jobs-quickstart), and [pricing](https://huggingface.co/docs/hub/jobs-pricing): launch, persistence, stopping, and billing.

### Limits of this guide

No training run or GPU benchmark was performed for this guide. There is no claim that the suggested corpus sizes, learning rates, or mixtures are optimal. Current rental prices are provider listings, not reserved capacity. Field reports use different software and objectives. A training budget should use a measured pilot on your chosen setup.

## 18. Current rental prices

**USD, checked 23 September 2026.** The Runpod pricing page says it was updated on 13 September. These are the publicly displayed **Pod** rates; confirm the selected cloud, region, instance configuration, and availability at launch. Hugging Face figures are **Jobs** rates. They are not inference API token prices. [Runpod pricing](https://www.runpod.io/pricing), [HF Jobs pricing](https://huggingface.co/docs/hub/jobs-pricing)

| Hardware | VRAM per GPU | Runpod published Pod rate | Hugging Face Jobs |
|---|---|---|---|
| RTX 6000 Ada | 48 GB | $0.84/hour | Not listed in the checked Jobs table |
| L40S | 48 GB | $1.09/hour | $1.80/hour |
| A100 | 80 GB | $1.59/hour | $2.50/hour |
| RTX PRO 6000 | 96 GB | $2.09/hour | $2.75/hour |
| H100 PCIe | 80 GB | $2.89/hour | Not listed in the checked Jobs table |
| H100 SXM | 80 GB | $3.49/hour | Not listed in the checked Jobs table |
| H200 | 141 GB | $4.59/hour | $5.00/hour |
| 4 × A100 | 80 GB each | Check whole-instance quote | $10.00/hour total |
| 8 × A100 | 80 GB each | Check whole-instance quote | $20.00/hour total |

Multiple GPUs do not automatically behave like one large memory pool. Use the memory chapter before treating a multi-GPU quote as a viable full-training configuration.

### Storage and additional charges

Runpod lists container disk at $0.10/GB/month, local volume at $0.10 while running or $0.20 while stopped, and standard network storage at $0.07 below 1 TB or $0.05 above 1 TB. A 200 GB standard network volume at $0.07 is **$14 per month**, by simple multiplication. Check billing duration and the chosen tier. Model downloads, checkpoint writes, evaluation, and idle time can also occupy billed GPU time. HF bucket storage is separate from the GPU quote; consult its current storage billing before retaining large checkpoints.

### Repricing reported training times

These are **our calculations using current listed rates**, not the authors' actual spending:

| Reported run | Calculation | Current-rate compute illustration |
|---|---|---|
| Antislop 27B training stage | 6.8 hours × $3.49 for H100 SXM | $23.73; assumes SXM rental for comparison, since the paper says H100 |
| Forge 27B training | 3.8 hours × $3.49 for H100 SXM | $13.26 |
| Persona Cartography 27B single-trait pipeline | 12-hour upper bound × $1.59 for A100 | Under $19.08 if run on the listed 80 GB option; the paper does not specify that variant |

Teacher API calls, data preparation, failed experiments, serving, and storage are not established by those multiplications. Antislop's own $13.30 is a historical estimate; it should not be substituted for today's quote. Read the linked field reports for the scope of each measured runtime.

## 19. Build your experiment budget

Use measured **training input tokens per second across the whole job**, not inference generation speed. Count all processed prompt and answer tokens and every planned epoch. Keep the numerator consistent with how throughput is measured: if the rate includes padded tokens, account for padding in the workload too.

```text
training hours = total processed tokens / aggregate tokens per second / 3600
compute cost = billed hours × whole-job hourly price
project cost = compute across all runs + storage + data work + other services
```

Below, overhead is a simple percentage allowance for loading, saving, evaluation, and idle time. Replace it with measured fixed overhead when you have a run log. If your measured throughput already includes those activities, do not count them twice. The default **300 tokens/second is an invented scenario for arithmetic**, not a Gemma or GPU benchmark.

<form id="budget-calculator" aria-label="Illustrative training budget calculator">
<div class="calculator-grid">
<label>Total processed tokens, millions<input name="tokens" type="number" min="0.001" step="any" value="50"><small>Include all epochs, replay data, prompts, and answers.</small></label>
<label>Aggregate training tokens/second<input name="throughput" type="number" min="0.001" step="any" value="300"><small>Replace this hypothetical rate with your measured rate.</small></label>
<label>Whole-job price, USD/hour<input name="hourly" type="number" min="0.001" step="any" value="1.59"><small>Use the total rate for every GPU in the job.</small></label>
<label>Additional time allowance, percent<input name="overhead" type="number" min="0" step="any" value="20"><small>An estimate for overhead outside the measured training rate.</small></label>
<label>Number of comparable runs<input name="runs" type="number" min="1" step="1" value="3"><small>For different stages, calculate each separately.</small></label>
</div>
<div class="calculator-results" aria-live="polite">
<div class="calculator-result">Hours per run<output data-cost-output="hours">55.56 hours</output></div>
<div class="calculator-result">Compute per run<output data-cost-output="per-run">$88.33</output></div>
<div class="calculator-result">Compute across runs<output data-cost-output="total">$265.00</output></div>
</div>
<p data-cost-status>Illustrative compute only; storage, tax, and other services are additional.</p>
<noscript><p>With the default assumptions: 50 million tokens ÷ 300 ÷ 3,600 × 1.20 = 55.56 hours. At $1.59/hour, three identical runs cost $265 in compute.</p></noscript>
</form>

### Why throughput matters more than the hourly sticker

For 100 million processed tokens, a hypothetical rate of 200 tokens/second takes about 138.9 training hours. At 1,000 tokens/second it takes 27.8 hours. These rates are sensitivity examples, not hardware claims. Benchmarking the actual trainer can change the estimate by far more than a small hourly discount.

### A budget with explicit assumptions

Suppose the whole project comprises 50 million CPT tokens and 15 million SFT tokens. If both stages averaged the hypothetical 300 tokens/second, they would need about 60.2 training hours. Add 20% overhead to get 72.2 hours, or **about $114.83 at $1.59/hour** for one combined sequence. Three such sequences would be about **$344.50** before storage and other services. In practice the stages can have different rates; measure and price them separately.

Reserve money for data review and evaluation, not only GPU training. A small smoke test should precede the full budget. Scale the run when the exported model gives better answers on unseen cases and the measured cost fits the value of that improvement.
