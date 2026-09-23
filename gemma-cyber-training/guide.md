---
title: LLM Training Field Guide
slug: gemma-cyber-training
edition: Tropical
updated: 2026-09-23
description: Cyber domain knowledge, problem-solving habits, and personality through CPT and SFT on rented GPUs.
---

# LLM Training Field Guide

## 1. Build knowledge, judgment, and voice

This guide explains LLM training mechanics and adaptation across model families, with Gemma 3 as a possible implementation example. Start with The mathematics of fine-tuning, Batches, and Optimization for the technical foundations. The Gemma-specific code and rental estimates are worked examples, not a requirement to choose that model.

For the motivating use case, you want a model that understands cybersecurity, approaches a problem methodically, and sounds like the assistant you want to work with. Those are three related training goals. Give each one its own data and evaluation criteria.

<ul class="flow"><li><strong>Knowledge</strong><small>Expose the model to accurate domain material. Continued pretraining is one way to adapt its representations.</small></li><li><strong>Approach</strong><small>Demonstrate how to interpret evidence, handle uncertainty, recommend a remedy, and check the result.</small></li><li><strong>Personality</strong><small>Make the desired voice visible in correct answers, disagreements, follow-up questions, and explanations.</small></li></ul>

The general route is **a pretrained base → continued pretraining → supervised fine-tuning → evaluation**. Gemma 3 27B PT is the concrete checkpoint used to illustrate it. The SFT stage combines domain tasks, problem-solving habits, and personality. Add preference tuning only if it solves a measured remaining problem.

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

### A separate route: change only the personality

If you already like the model's knowledge and task performance, use **an instruction-tuned model → personality SFT with LoRA or QLoRA → capability checks** (Gemma 3 27B IT is one example). CPT is unnecessary for this objective. You are supplying demonstrations of a different interaction style, rather than intentionally adding a new domain corpus. The resulting behavior can still affect correctness, so preservation must be measured.

| Your desired outcome | Appropriate first experiment | Why |
|---|---|---|
| A different default voice on familiar tasks | Small personality SFT adapter on IT | Existing instruction behavior gives the voice something useful to attach to |
| Several selectable voices | Independently train each adapter against the same exact base | Each variant can be evaluated and enabled separately |
| Same voice, better cyber knowledge and approach | Domain training route in this guide | The missing ingredient is specialist supervision |
| Good answers but a repeated unwanted style habit | Targeted SFT corrections; consider preference tuning afterward | Narrow examples can focus on the observed habit |
| A persona that only appears when requested | Include the persona condition consistently in training and inference | The condition is part of the behavior you are teaching |

Keep a prompt-only version as an inexpensive baseline. This does not replace your goal of training the personality; it reveals whether the training actually improves consistency, shortens the required prompt, or helps across longer conversations.

### Step 1: write a behavior specification

Choose a few observable traits. “A witty, warm expert” is too vague to label reliably. A more useful specification says: answer directly; use everyday phrasing; challenge false premises gently; give short explanations unless detail is requested; use humor sparingly; preserve uncertainty. Include the situations in which a trait should recede. Humor that helps a casual explanation may be inappropriate during an urgent incident.

Avoid teaching an invented biography unless you actually need a fictional character. Voice can be distinctive without claims of personal experiences, credentials, or actions the model never took. Define the desired length separately from the desired warmth: they are different properties.

### Step 2: make examples across ordinary tasks

For a first pilot, **1,000–5,000 reviewed examples** is a reasonable experimental budget, not a guaranteed requirement. Sample the tasks you want the model to keep doing: technical explanations, everyday questions, summaries, editing, structured answers, disagreement, and follow-up conversations. Include easy and difficult prompts and requests for both brief and detailed answers.

Make the target response factually sound before editing its voice. You can start with checked existing answers and rewrite them, or write original examples. A teacher model can draft the rewrites, but review a representative sample and all high-impact or technically subtle answers. If the teacher inserts new claims, they become part of the training signal.

For example, both versions below should express the same conclusion:

| Prompt | Technically correct neutral answer | Example target voice |
|---|---|---|
| Does a failed sign-in prove someone got into the account? | No. A failed sign-in establishes that the attempt failed. Additional evidence is needed to assess account access. | No—the log says that attempt failed. To decide whether anyone got in, we need evidence of a successful session or other account activity. |
| I changed two settings and now it works. Which one fixed it? | The result does not identify which change caused the improvement. Test the changes independently if feasible. | We know the combination worked, but we do not yet know which setting mattered. Try each change separately in a controlled test, if you can. |

The style target is the manner of explanation, not extra confidence. Avoid using thousands of near-identical catchphrases. Include responses that disagree, correct earlier mistakes, say they lack enough evidence, and obey exact formats where personality should not add extra prose.

### Step 3: train a modest adapter first

An illustrative **personality-only pilot** uses QLoRA on 27B IT, rank 16, learning rate `5e-5`, one epoch, microbatch 1, accumulation 16, and a sequence length chosen to fit most of the conversations—often 2,048 or 4,096 tokens for an economical experiment. Use roughly 3% warmup and save intermediate checkpoints. These are proposed starting settings, not a validated personality recipe for every dataset.

Change one setting in response to the results. If the voice barely changes while task quality holds, compare `1e-4` at the same rank and token budget. If the first epoch clearly helps and held-out quality keeps improving, compare a second epoch. If both training and validation remain weak after fixing the data and rate, rank 32 is another capacity experiment. Do not increase all three at once.

For a small personality project, full-weight tuning is usually a larger and more expensive intervention than you need to try first. Adapter size is also convenient for switching and rollback. QLoRA saves base-weight memory, but the computation through the model remains substantial.

### Step 4: test the personality without announcing it

If you want the personality to be the default, test prompts without a persona instruction. Include at least some unseen topics and multi-turn conversations. Compare three versions: untouched IT, IT with your persona prompt, and IT with the trained adapter. Keep generation settings and task inputs matched.

Score voice separately from factual correctness and instruction compliance. Check whether concise answers became evasive, confidence became fabrication, friendliness became agreement with false statements, or skepticism became reflexive contradiction. Also test JSON-only and other exact-format prompts: style must yield to the requested output format.

### Step 5: keep or refine the result

Keep the smallest intervention that achieves the desired voice with acceptable retained performance. If a particular habit persists, add examples of that situation. If the voice is strong but useful skills decline, compare an earlier checkpoint, lower learning rate, fewer exposures, or a broader task mixture. Optional DPO can address a consistent preference that remains after SFT; it adds data and evaluation work, so it is not an automatic next step.

Save the personality adapter independently with its exact base revision. If you later want the same voice on your cyber-adapted model, test it carefully: an adapter trained on untouched IT was not trained against your new CPT/SFT checkpoint. Training a new voice adapter against the selected specialist checkpoint, or including the voice directly in specialist SFT, produces a clearer lineage.

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

### How many runs should you choose?

The **number of experiment runs is a budget and confidence decision**, not a single learning control. Each independent run normally begins from the same chosen starting checkpoint. Five independent runs produce five candidate models; they do not automatically combine into a model that has learned five times as much. Continuing one model for five stages is a different experiment.

Separate four counts in your notes:

| Count | What it means | Choose it to answer |
|---|---|---|
| Epochs within a run | Repeated exposure to the training set | Has this candidate learned enough, or started overfitting? |
| Configuration trials | Different learning rates, ranks, mixtures, or other settings | Which recipe works better? |
| Seed repeats | Same recipe with different randomness | Does the improvement survive a different shuffle or adapter initialization? |
| Stages | CPT, SFT, and any later adaptation | What should the model learn next? |

### A concrete five-run plan

After a small smoke test, the following plan is manageable for a first adapter SFT project. The example rates are hypotheses; keep the data, base, template, and evaluation fixed.

| Run | Configuration | Decision it supports |
|---|---|---|
| 1 | Rank 16, `5e-5`, one epoch, seed 42 | Establish a conservative training baseline |
| 2 | Rank 16, `1e-4`, one epoch, seed 42 | Compare a stronger update rate |
| 3 | Better rate from runs 1–2, two epochs, seed 42 | Test whether more exposure helps; inspect the first-epoch checkpoint too |
| 4 | Selected configuration, seed 17 | Check sensitivity to randomness |
| 5 | Selected configuration, seed 73 | Check whether the result is consistent enough to trust |

The untouched model and the prompt-only personality baseline need evaluation but no training. This five-run plan does not include them in its training count. A two-epoch candidate can cost roughly twice its training time at one epoch, so **five runs need not mean five equal bills**. Account for each token budget separately.

With a very tight budget, do runs 1–2 and inspect the failure cases before spending more. With a clear winner and little room for uncertainty, add a seed repeat before a broad hyperparameter search. If the recipe fails badly, stop and repair the data or implementation; repeating it with ten seeds is unlikely to solve the cause.

### Compare fairly

For a configuration comparison, keep the starting weights and data split fixed. For a seed comparison, keep the settings fixed. Changing the corpus, rank, epoch count, and seed together prevents you from attributing the result. Track actual processed tokens as well as the intended settings, especially when packing changes the number of sequences.

Predefine the main evaluation criteria. Select on development results, then report the final candidate on the untouched test set. Trying more candidates and repeatedly selecting on the test set can make the reported score look better without improving real usefulness.

### Epochs versus max steps

Many trainers, including Hugging Face Trainer, allow an epoch budget or a fixed optimizer-step budget; a positive `max_steps` overrides the epoch setting. With streaming data, a fixed token/step budget is often easier to reason about. Check the behavior of your installed trainer rather than assuming both settings will be multiplied. [Trainer configuration](https://huggingface.co/docs/transformers/main_classes/trainer)

Suppose effective batch is 16 and the run stops at 1,000 updates. That is approximately 16,000 sequence exposures. If packing is disabled and the dataset contains 8,000 examples, it is about two passes. If examples are packed into longer sequences, that inference no longer holds. Report steps, exposures, and measured tokens with their definitions.

### Restarting a schedule changes the experiment

Three one-epoch jobs that each restart warmup and learning-rate decay are not the same optimization schedule as one three-epoch job. Restarting only from an adapter file also resets optimizer history. To resume a paused run, load a supported full training checkpoint. To try a new recipe, deliberately start a new run and label it that way.

## 9. The mathematics of fine-tuning

Fine-tuning starts from learned parameters, θ₀, and optimizes them—or an added parameter subset—on a new training distribution. The central question is **which behavior the objective rewards, and how much adaptation preserves useful prior capability**. Batches, learning rate, epochs, and adapter rank influence that process in different ways.

This chapter focuses on supervised fine-tuning of autoregressive LLMs. Continued pretraining uses a closely related next-token objective on ordinary text. Preference methods introduce different losses and data requirements. The equations apply across model families; Gemma-specific loading and formatting belong to the later implementation example.

### What supervised fine-tuning minimizes

Let x be a prompt and y a demonstrated answer. For a single answer of M tokens, a common sequence-normalized SFT loss is:

```text
ℓ(x, y; θ) = −(1/M) × Σ[t=1..M] log pθ(y_t | x, y_1, …, y_(t−1))
```

The model is rewarded for assigning probability to the demonstrated next token given the prompt and preceding reference-answer tokens. The logarithm is normally natural log. A target assigned probability 0.5 contributes about 0.693 loss; probability 0.1 contributes about 2.303. Increasing the probability of the correct target lowers its loss.

The dataset objective then combines these losses. Averaging each sequence's mean gives equal example weight. Summing all token losses and dividing by all target tokens gives equal token weight. With variable answer lengths these are different objectives. The Batches chapter works through the arithmetic.

**Practical implication:** SFT learns statistical regularities in the supplied answers. It has no automatic separate score for truth, politeness, reasoning validity, or useful brevity. If incorrect answers consistently sound confident, ordinary SFT rewards those confident target strings. Dataset review and task evaluation therefore carry semantic responsibilities that cross-entropy does not supply.

### Teacher forcing and causal attention

During ordinary SFT, the model receives the correct previous answer tokens as context, a procedure called teacher forcing. A causal attention mask prevents a position from looking at future answer tokens. Although prediction is autoregressive, training can compute losses for many positions in parallel because the entire reference sequence is already available.

At deployment, the model conditions on its own previous generated tokens. An early mistake can move it into a context unlike the reference trajectories it saw during training. This is one reason a falling teacher-forced validation loss does not guarantee reliable multi-step generated answers.

The loss mask and attention mask serve different purposes. Prompt tokens may be ignored as targets while still providing context that changes answer predictions. Ignoring their labels does not mean the model ignores the prompt. Conversely, including user tokens in the loss trains an additional objective: predicting user text as well as responses.

### Backpropagation connects the answer to the weights

For logits z passed through softmax, the cross-entropy derivative at a target position is `p − one_hot(target)`. Backpropagation applies the chain rule through the network to determine how each trainable parameter contributed. The optimizer then transforms the gradient into a parameter update.

The same weight can affect many facts, styles, and tasks. There is generally no isolated “personality register” that ordinary SFT edits while leaving all knowledge untouched. A style example changes next-token preferences, which can also change answer length, confidence, whether caveats appear, and sometimes correctness. Test preservation rather than assuming it from the training label “personality.”

### Full fine-tuning versus a restricted update

In full fine-tuning, the chosen model parameters can all change. In LoRA, a selected matrix is represented as a frozen base plus a trainable low-rank perturbation:

```text
W_effective = W₀ + (α/r) × U × V
W₀ shape: d_out × d_in
U shape: d_out × r
V shape: r × d_in
Trainable adapter parameters: r × (d_out + d_in)
```

The perturbation has rank at most r for that matrix. For a 4,096 × 4,096 matrix, full tuning exposes 16,777,216 parameters; rank 16 exposes 131,072 adapter parameters, or about 0.78% as many. This is a per-matrix calculation, not the trainable fraction of an entire model. Targets and dimensions determine that total. The factor α/r describes standard LoRA scaling; other variants use different scaling. [Hu et al., LoRA](https://arxiv.org/abs/2106.09685)

Rank controls the allowed update structure, not the number of facts the model can store. More rank gives a less restrictive parameterization and greater training cost; it does not guarantee a better optimum or less overfitting. Targeting more projections changes where adaptation can occur. These are architectural decisions distinct from batch size.

QLoRA keeps the pretrained base quantized while training adapters through it. The original work introduced NF4, double quantization, and paged optimizers as memory techniques. A particular implementation need not use every component. Quantization changes numerical representation; it is not a new supervision objective. [Dettmers et al., QLoRA](https://arxiv.org/abs/2305.14314)

### Adaptation, overfitting, and forgetting are different

| Phenomenon | What it means | Evidence to look for |
|---|---|---|
| Useful adaptation | Improvement on the intended new distribution | Better held-out task outcomes and required style |
| Underfitting | Insufficient fit to the intended training pattern | Training and validation remain weak; inspect implementation and labels first |
| Overfitting | Learning details that do not transfer to unseen cases | Training improves while validation stagnates or worsens |
| Forgetting/interference | Existing capabilities degrade during adaptation | Lower scores on preserved general tasks, languages, formats, or calibration |
| Distribution shift | Deployment differs from training and validation | Failures on new sources, prompt forms, lengths, or task mixtures |

Forgetting can occur even while target-domain validation improves. It is not synonymous with ordinary overfitting. Biderman and colleagues found lower-rank LoRA learned less than full tuning in their math/programming settings while better preserving out-of-domain performance. That is evidence of an adaptation–retention tradeoff, not a universal ranking of methods. [LoRA Learns Less and Forgets Less, TMLR 2024](https://arxiv.org/abs/2405.09673)

Practical controls include a smaller update budget, a lower learning rate, broader task coverage, rehearsal examples from capabilities you want to preserve, or a more restricted trainable parameter subset. None guarantees preservation. Evaluate several checkpoints because maximum target-domain fit and best overall usefulness may occur at different times.

### Regularization is not one knob

Dropout introduces stochastic masking during training. Weight decay discourages some parameter growth according to the optimizer's formulation. Early stopping limits how far optimization proceeds. Data mixing changes what distribution is rewarded. Restricting rank changes the set of possible updates. These interventions have different mechanisms and should not be treated as interchangeable fixes.

In particular, AdamW decay toward zero is **not** an explicit penalty for moving away from pretrained weights θ₀. Such a penalty would involve a quantity like `||θ − θ₀||²`, not `||θ||²`. Freezing the base and training an adapter preserves the stored base weights, but the active adapter still changes the model's function.

### What validation loss tells you

Validation cross-entropy measures how well the model predicts held-out reference tokens under the chosen mask and weighting. For a consistent token-level mean loss L in natural-log units, perplexity is `exp(L)`. Compare it only with matching data, tokenizer, context handling, masking, and weighting. A short-answer SFT loss and full-document CPT loss are not directly comparable measures of competence.

Multiple good answers can use different wording. A model may assign lower probability to the reference wording while producing a useful answer, or predict reference phrasing well while generating poorly elsewhere. Pair loss with generated task evaluations: correctness, evidence use, format compliance, style, uncertainty, and general-capability retention.

Use a development split for checkpoint and hyperparameter selection, and a separate final test set. Group related conversations/documents together during splitting. Many trials on the same test set turn it into a development set even if the files retain the name “test.”

### A fine-tuning study you can interpret

| Decision | Academic question | Practical measurement |
|---|---|---|
| Training examples and mixture | Which distribution is being optimized? | Source diversity, task coverage, answer-token weights |
| Loss mask/reduction | Which predictions receive how much weight? | Decoded targets and valid-token counts |
| Batch size | What gradient estimate and update frequency are used? | Sequences/tokens per update and total updates |
| Learning rate and schedule | How does optimization traverse parameter space? | LR against tokens, loss curves, gradient/update norms |
| Optimizer settings | How are gradients transformed over time? | Betas, decay, clipping, state initialization |
| Rank and target layers | Which parameter changes are representable? | Trainable fraction, target modules, validation tradeoffs |
| Epochs/token budget | How much exposure and optimization occur? | Unique versus repeated tokens, checkpoint trajectories |
| Evaluation | Did the intended change generalize? | Held-out task gains, style adherence, retained skills, seed variation |

A useful progression is: inspect the objective on a tiny batch; run a short technical smoke test; establish one measured baseline; vary a small number of hypotheses; then scale the data or run budget. A smoke test validates execution. An academic claim about improvement requires a controlled comparison and evidence of generalization.

### Suggested academic reading order

1. [LoRA](https://arxiv.org/abs/2106.09685) and [QLoRA](https://arxiv.org/abs/2305.14314): how parameter and representation choices reduce adaptation cost.
2. [Adam](https://arxiv.org/abs/1412.6980) and [AdamW](https://arxiv.org/abs/1711.05101): the optimizer mechanics used by many practical recipes.
3. [An Empirical Model of Large-Batch Training](https://arxiv.org/abs/1812.06162), then [Critical Batch Size Revisited](https://arxiv.org/abs/2505.23971): foundational intuition and later qualifications.
4. [Small Batch Size Training for Language Models](https://arxiv.org/abs/2507.07101): why optimizer timescales matter when changing batch size.
5. [LoRA Learns Less and Forgets Less](https://arxiv.org/abs/2405.09673): why task gains and retention should be measured separately.

For each paper, record its model sizes, initial checkpoints, data regime, optimizer, tuning budget, and evaluation. A pretraining scaling result is useful context for fine-tuning, but is not direct evidence that the same numeric setting is optimal for a small assistant or personality dataset.

## 10. Batches, tokens, and the training loop

This chapter applies to autoregressive language models generally: Gemma, Llama, Qwen, and other compatible architectures. Model-specific details include the tokenizer, chat template, attention implementation, and supported training libraries. **Batching is a general optimization concept.** Gemma is the worked deployment example elsewhere in this guide.

### Start with what happens in one update

A language model assigns probabilities to possible next tokens. During training, the correct next token comes from the dataset. A loss function measures how poorly the model predicted it. Backpropagation computes the gradient: the local sensitivity of that loss to each trainable parameter. The optimizer uses that gradient and, often, stored information from earlier gradients to change the parameters.

<ul class="flow"><li><strong>Forward pass</strong><small>Read a batch and calculate next-token probabilities and loss.</small></li><li><strong>Backward pass</strong><small>Calculate gradients for the trainable parameters.</small></li><li><strong>Optimizer update</strong><small>Use the accumulated gradient to change weights, then clear the gradient buffer.</small></li></ul>

The **weights stay fixed during gradient accumulation**. Several forward/backward passes can contribute to one update. By contrast, several ordinary optimizer steps evaluate later examples at already changed weights. Those procedures generally produce different models.

### Vocabulary with units

| Term | Precise meaning | Example |
|---|---|---|
| Training example | One dataset record, before formatting and packing | One document or conversation |
| Sequence | One tokenized model input | A 2,048-token block; it may contain one or several examples |
| Token | One tokenizer unit, not necessarily a word | A word part, punctuation, or a control token |
| Microbatch | Sequences processed in one forward/backward pass on one data-parallel replica | Two sequences |
| Accumulation factor, A | Number of microbatches contributing before an optimizer update | Eight passes |
| Data-parallel replicas, D | Copies of the model processing different data and combining gradients | Four replicas |
| Global/effective batch, B | Sequences contributing to one optimizer update across those replicas | 2 × 8 × 4 = 64 sequences |
| Optimizer step/update | One application of the optimizer to the trainable parameters | AdamW update number 100 |
| Epoch | One pass over the defined finite dataset | All records once, subject to sampler/drop rules |
| Training run | One experiment from an initial state to a stopping point | Two epochs with one configuration and seed |

“Batch size” is ambiguous unless you specify **sequences or tokens, per-device or global, and before or after accumulation**. “Step” can mean a dataloader iteration or optimizer update in different tools. In this guide, an unqualified training step means an optimizer update.

### The effective-batch equation

For equal microbatches and ordinary data parallelism:

```text
B_sequences = microbatch_per_replica × accumulation_steps × data_parallel_replicas
```

Four GPUs do not always mean four data replicas. If four GPUs jointly hold one tensor-parallel model replica, they are processing one distributed copy of a batch; multiplying by four would overcount examples. Pipeline parallelism also has its own scheduling notion of microbatches. Record the actual parallelism topology.

These are three ways to assemble 32 sequences for one update:

| Microbatch per replica | Accumulation | Data replicas | Effective sequences/update |
|---|---|---|---|
| 1 | 32 | 1 | 32 |
| 4 | 8 | 1 | 32 |
| 4 | 2 | 4 | 32 |

With matching data, correct normalization, and compatible model behavior, their accumulated gradients can be mathematically equivalent. Their memory, communication, runtime, and floating-point results need not be identical. Random masks, reduction order, and batch-dependent layers can also affect equivalence. This is an equivalence to **one update**, not to 32 sequential updates.

### Sequence count is not token count

Let L be average non-padding input length, and R average supervised target length after causal shifting and loss masking:

```text
Input tokens/update       ≈ B_sequences × L
Supervised tokens/update  ≈ B_sequences × R
Padding positions         = allocated sequence positions − actual input tokens
```

In CPT, most real tokens after the first position are targets. In assistant-only SFT, user instructions and supplied context consume compute but are not direct target labels. A long prompt with a short answer can therefore have a low supervised-token fraction.

**Worked example:** microbatch 2, accumulation 8, two data replicas means 32 sequences/update. At 1,500 actual input tokens and 300 supervised answer tokens per sequence, that update processes roughly **48,000 input tokens** but supervises **9,600 target tokens**. If each microbatch is padded to length 2,048, its aggregate allocated positions total 65,536; utilization is about 73.2%. Padding is not additional training information.

This distinction matters for personality SFT. Ten long verbose answers can contribute many more target tokens than ten concise answers. The loss reduction and sampling policy determine their relative influence; simply counting conversations does not reveal it.

### From dataset size to update count

For N already prepared sequences, E epochs, no dropped records, and full batches:

```text
Approximate updates = E × N / B_sequences
```

Real counts depend on incomplete batches, distributed sampler padding, accumulation at epoch boundaries, packing, and trainer behavior. Use logs for the exact total. For a fixed processed-token budget T, use measured input tokens/update instead of raw record counts.

Consider 32,000 fixed-length sequences, one epoch, one GPU:

| Microbatch | Accumulation | Effective batch | Updates | Sequence exposures |
|---|---|---|---|---|
| 4 | 2 | 8 | 4,000 | 32,000 |
| 4 | 8 | 32 | 1,000 | 32,000 |
| 4 | 32 | 128 | 250 | 32,000 |

All three see the same number of sequences. The last changes the weights only one-sixteenth as often as the first. Keeping **1,000 updates** instead would give 8,000, 32,000, and 128,000 exposures respectively. “Same number of steps” is not a fair equal-data comparison across different effective batches.

### Explore the arithmetic

<form id="batch-calculator" class="budget-calculator">
<div class="calculator-grid">
<label>Prepared sequences in dataset<input name="examples" type="number" min="1" step="1" value="32000"></label>
<label>Epochs<input name="epochs" type="number" min="0.01" step="0.1" value="1"></label>
<label>Microbatch per data replica<input name="micro" type="number" min="1" step="1" value="4"></label>
<label>Accumulation steps<input name="accum" type="number" min="1" step="1" value="8"></label>
<label>Data-parallel replicas<input name="replicas" type="number" min="1" step="1" value="1"></label>
<label>Mean real input tokens/sequence<input name="length" type="number" min="1" step="1" value="1500"></label>
<label>Mean supervised targets/sequence<input name="targets" type="number" min="1" step="1" value="300"></label>
</div>
<div class="calculator-results" aria-live="polite"><p><strong data-batch-output="effective">32</strong> sequences/update</p><p><strong data-batch-output="updates">1,000</strong> approximate updates</p><p><strong data-batch-output="inputs">48,000</strong> input tokens/update</p><p><strong data-batch-output="supervised">9,600</strong> supervised tokens/update</p><p><strong data-batch-output="total">48,000,000</strong> total input-token exposures</p></div>
<p data-batch-status>Arithmetic estimate; assumes constant average lengths and full batches. It does not predict quality or GPU memory.</p>
</form>

Try raising accumulation from 8 to 32. Updates fall from 1,000 to 250 while total data exposure stays fixed. Then raise microbatch to 8 and lower accumulation to 4: the original effective batch is restored, but peak activation memory and throughput may change. These are different experimental questions.

### Padding, bucketing, truncation, and packing

| Method | What it does | Consequence for learning and execution |
|---|---|---|
| Dynamic padding | Pads to the longest sequence in that microbatch | Reduces unused positions; actual memory can spike when a long record arrives |
| Length bucketing | Groups similar lengths | Reduces padding, but length may correlate with topic or difficulty; shuffle bucket order |
| Truncation | Removes tokens past a limit | Changes the training example and may delete the answer or essential context |
| Chunking | Splits a long document into blocks | Retains more text, but limits dependencies across block boundaries |
| Packing | Places several examples into fuller sequences | Improves utilization; changes sequence counts and requires explicit boundary semantics |

An EOS marker alone does **not** prevent later tokens from attending to an earlier packed example. Independent-example packing needs appropriate attention boundaries and label handling; position-ID resets alone do not establish isolation unless the attention implementation uses them that way. Concatenated-document CPT is another deliberate objective. Know which one your trainer implements. TRL exposes packing and padding-related options; inspect the selected strategy and masks rather than assuming every framework treats boundaries alike. [TRL SFT documentation](https://huggingface.co/docs/trl/en/sft_trainer)

Longer context does not automatically add knowledge. It makes longer dependencies available to the model, at a cost. Dense global attention has a quadratic sequence-length compute component; other parts scale differently, and sliding-window attention and memory-efficient kernels change the practical profile. Doubling context is therefore not generally the same cost as doubling sequence batch size.

### Loss normalization: the subtle part

For token-weighted causal language modeling, the batch objective is the sum of negative log probabilities for valid target tokens divided by their count. Masked prompts and padding contribute neither numerator nor denominator. The first token has no preceding prediction within its sequence and is excluded after causal shifting.

```text
L = (sum of losses over valid target tokens) / (number of valid target tokens)
g = gradient of L with respect to trainable parameters
```

For accumulation, a mean of microbatch means differs from a global token mean when supervised token counts vary. Hugging Face documents this distinction and the need to normalize across the accumulation window. Distributed reduction must also match the intended global normalization. [Gradient accumulation correction](https://huggingface.co/blog/gradient_accumulation), [current token-counting documentation](https://huggingface.co/docs/transformers/grad_accumulation)

**Numerical example:** microbatch A has 100 targets with mean loss 2; B has 900 targets with mean loss 1. Averaging means gives `(2 + 1)/2 = 1.5`. A token mean gives `(100×2 + 900×1)/1000 = 1.1`. The first gives each microbatch half the influence; the second gives each target equal weight. Neither number changes because you rename the effective batch.

Equal-example weighting can be a deliberate SFT objective: average each answer's token loss, then average answers. This prevents long responses from automatically receiving greater total weight. Define that objective explicitly; a mean of variable-size microbatch means is not generally equal-example weighting either.

**Starter-code connection:** this guide's pinned Gemma teaching script uses a mean loss per microbatch and scales accumulation accordingly. At microbatch one, that gives each sequence equal weight within a full accumulation window. It does not implement a global token-weighted loss across variable-length microbatches. If you want token-weighted equivalence, change and test the loss reduction before comparing accumulation configurations. The starter remains GPU-unverified.

### What batch size cannot guarantee

A bigger batch does not expand the context window, increase parameter count, add factual knowledge by itself, or make the model perform more reasoning at inference. It changes how training evidence is combined into updates. The curriculum, objective, parameter subset, learning rate, and total data exposure determine what that evidence teaches.

## 11. How batch size changes optimization

Batch size is both a **statistical choice** and a **hardware choice**. Statistically, it determines how much data estimates each gradient. Operationally, it affects how work is parallelized, when weights update, and how memory is used. A configuration can be efficient in tokens per second while being inefficient in tokens required to reach the desired quality.

### The stochastic-gradient view

Let θ denote the trainable parameters. Let ℓᵢ(θ) be the loss of training unit i under your chosen weighting. For B equally weighted sampled units:

```text
g_B = (1/B) × sum of ∇θ ℓᵢ(θ)
SGD update: θ_next = θ − η × g_B
```

Here η is learning rate. The gradient is an estimate of the gradient over the full training distribution. Under independent sampling with finite covariance Σ, the covariance of the average is `Σ/B`; typical noise amplitude falls roughly as `1/√B`. Sixteen times as many independent units gives about one-quarter the noise amplitude, not sixteen times the learning.

That is a simplified statistical model. Tokens within one document are correlated; duplicate answers, related records, and fixed-order curricula violate the independence assumption. Thousands of tokens from one repetitive document do not offer the same diversity as independent evidence. Batch size reported in tokens is useful accounting, but token count alone does not specify gradient noise.

### Smaller versus larger batches

| Property | Smaller effective batch | Larger effective batch |
|---|---|---|
| Gradient estimate per update | Usually noisier under comparable sampling | Usually closer to the average training gradient |
| Updates for a fixed data budget | More | Fewer |
| Reaction to newly encountered examples | More frequent parameter changes | Changes after pooling more examples |
| Hardware opportunity | May underfill a GPU if the physical microbatch is tiny | Larger physical batches can improve utilization until limits are reached |
| Risk | Unstable updates with an unsuitable learning rate or optimizer | Wasting samples on redundant gradient averaging; too few useful updates |
| Generalization | Can benefit from stochasticity in some settings | Can also generalize well with a suitable recipe; no universal ordering |

Gradient noise can influence the optimization path and act as an implicit regularizer. It is not equivalent to deliberately adding useful diversity, and it does not guarantee better held-out performance. “Small batches find flat minima” is an intuition from some research settings, not a reliable rule for selecting an adapter SFT batch. Judge the model on held-out tasks and retained capabilities.

### Critical batch size and diminishing returns

McCandlish and colleagues proposed gradient noise scale as a predictor of useful batch sizes and described the tradeoff between compute efficiency and elapsed training time. The practical idea is diminishing returns: beyond a problem-dependent region, averaging more examples before each update buys progressively less improvement. The location can evolve during training. [An Empirical Model of Large-Batch Training, 2018](https://arxiv.org/abs/1812.06162)

Later results refine this picture. Zhang and colleagues studied autoregressive models from 85M to 1.2B parameters and found critical batch size depended primarily on data scale in their experiments. Merrill and colleagues directly measured it on OLMo 1B/7B runs and questioned assumptions behind using gradient noise as a universal proxy. These findings do not give a lookup table for a 27B personality adapter. [How Does Critical Batch Size Scale in Pre-training?, ICLR 2025](https://arxiv.org/abs/2410.21676), [Critical Batch Size Revisited, 2025](https://arxiv.org/abs/2505.23971)

**Practical inference:** model size alone does not determine the right batch. Data distribution, training stage, optimizer, target loss, and compute budget also matter. A large pretraining run's global token batch should not be copied into a small SFT experiment without testing.

### Why more accumulation can make a run worse

Accumulation is useful when you want a particular effective batch that cannot fit as a physical microbatch. It trades serial passes for activation-memory savings. It does not create additional information and does not reproduce the parallel speed of a larger physical batch.

At fixed data exposure, increasing accumulation reduces the number of updates. On one GPU, accumulating 32 tiny batches can postpone useful parameter changes while still doing all 32 passes. Whether the smoother gradient compensates for fewer updates is an empirical question.

Marek and colleagues found that small-batch language-model training could be stable and competitive when optimizer settings were adjusted, especially the second-moment timescale. Their NeurIPS 2025 paper recommends against routine accumulation outside certain multi-replica settings. Treat this as evidence that accumulation deserves testing, not as a guarantee that batch one wins for every model or corpus. [Small Batch Size Training for Language Models, 2025](https://arxiv.org/abs/2507.07101)

### Learning rate and batch size interact

With a **mean** loss, increasing batch size does not automatically multiply the expected gradient by B. It changes its variance and how often an update happens per token. Larger batches can sometimes tolerate a higher learning rate, but the appropriate change depends on optimizer, objective, and stage.

The familiar linear learning-rate scaling rule has influential evidence from large-batch ImageNet SGD, paired with warmup. It is not a general theorem for AdamW, CPT, LoRA, or SFT. Square-root rules also rely on assumptions. Use such rules to propose experiments, not to certify a setting. [Goyal et al., Accurate, Large Minibatch SGD, 2017](https://arxiv.org/abs/1706.02677)

Changing batch while freezing every other setting answers, “What happens under this fixed recipe?” Retuning learning rate for each batch answers, “What is the best performance each batch can achieve within this search budget?” Both are valid experiments; label which one you ran.

### AdamW: the optimizer remembers previous gradients

Adam maintains moving estimates of the gradient and its elementwise square. It uses bias-corrected versions to scale parameter updates. In simplified notation:

```text
m_t = β1 × m_previous + (1 − β1) × g_t
v_t = β2 × v_previous + (1 − β2) × g_t²
update direction ≈ corrected_m / (sqrt(corrected_v) + ε)
```

β1 controls the first-moment memory, β2 the second-moment memory, and ε numerical stabilization. These are **optimizer-step timescales**. AdamW additionally applies weight decay separately from the adaptive gradient transformation. [Adam, Kingma and Ba](https://arxiv.org/abs/1412.6980), [Decoupled Weight Decay Regularization, Loshchilov and Hutter](https://arxiv.org/abs/1711.05101)

For an exponential moving average, the half-life of an old contribution is:

```text
Half-life in updates = ln(0.5) / ln(β)
Half-life in tokens ≈ half-life in updates × tokens/update
```

At β2 = 0.999, the half-life is about 693 updates. If batch tokens rise fourfold and β2 stays fixed, its memory spans roughly four times as many tokens. To preserve that token half-life algebraically, use `β_new = β_old^(new_batch_tokens / old_batch_tokens)`; for a fourfold increase, `0.999^4 ≈ 0.996006`. This preserves one timescale only. It is **not** a complete optimizer-scaling prescription or a reason to change beta values blindly.

Decay and schedules have the same accounting issue. In a simplified AdamW decay-only step, `θ ← (1 − ηλ)θ`. Fewer updates at fixed epochs change the cumulative decay even if λ is unchanged. Likewise, 100 warmup updates span 3,200 sequences at batch 32 but 12,800 at batch 128. Record learning-rate schedules against processed tokens as well as step number.

### Clipping, precision, and memory

Gradient clipping caps a gradient norm according to a chosen threshold; it can limit unusually large updates, but cannot repair incorrect loss masks or consistently bad data. To emulate one accumulated batch, normally normalize and accumulate first, then clip once before the optimizer update. Clipping each microbatch separately is a different transformation. With scaled mixed-precision gradients, unscale before norm clipping. [PyTorch gradient clipping](https://docs.pytorch.org/docs/stable/generated/torch.nn.utils.clip_grad_norm_.html)

Memory is approximately the sum of weights, trainable gradients, optimizer states, activations, temporary buffers, and implementation overhead. Increasing the physical microbatch mostly increases activations and associated buffers. Increasing accumulation usually does not require retaining all earlier computation graphs: backward frees each graph while gradients accumulate. It therefore increases work per update without the same proportional activation-memory increase.

LoRA changes which parameters receive gradients and optimizer state; QLoRA also quantizes the frozen base. Neither removes the forward/backward computation needed through the model to train adapters. Gradient checkpointing saves activations by recomputing parts of the forward pass. These controls solve different memory costs; none determines the statistically best effective batch by itself.

### Batch composition can change the behavior you learn

Random shuffling reduces dependence on arbitrary file order. If all formal answers come first and casual answers last, late-stage training can emphasize the latter. Repeated examples increase exposure to their pattern; accumulation does not cancel that bias.

For mixed-domain CPT, decide whether mixture weights are by documents, sequences, or tokens. For SFT, decide whether long answers should have more total loss weight. A 50/50 mix of conversation counts may be far from a 50/50 mix of answer tokens. To change personality while retaining competence, include desired-style examples across many task types and measure general task performance alongside style.

A homogeneous batch may produce a strongly aligned gradient for one behavior. A diverse batch combines potentially conflicting gradients. Neither is automatically better: homogeneous batches can make updates alternate sharply across tasks, while excessive averaging can dilute rare objectives. Curriculum and sampling are training choices to evaluate, not just dataloader conveniences.

### A controlled batch experiment

1. Fix the starting checkpoint, tokenizer/template, data split, loss weighting, context policy, and evaluation prompts.
2. Benchmark physical microbatches that fit with memory headroom. Record steady-state real tokens/second, supervised targets/second, and peak VRAM. Include longest expected sequences.
3. Choose several effective batches that your hardware can realize. For a small SFT pilot, 8, 32, and 128 sequences are illustrative comparison points, not recommended optima.
4. Compare them at equal processed-token exposure. Recalculate update counts and schedule milestones. Also compare wall time and cost to reach a quality threshold.
5. Use a small learning-rate search for each batch if the question is best achievable performance. Document whether optimizer betas and decay were held fixed or retuned.
6. Select on held-out validation, then repeat promising settings with additional seeds. Keep a final test set unused during selection.

| Record per candidate | Why it matters |
|---|---|
| Microbatch / accumulation / data replicas | Explains the physical and effective batch |
| Input and supervised tokens/update | Describes both work and objective weighting |
| Total tokens, optimizer steps, epochs | Makes the training budget comparable |
| LR schedule, betas, decay, clipping | Captures coupled optimization choices |
| Validation loss and task/style scores | Distinguishes prediction fit from useful behavior |
| Wall time, peak VRAM, rental cost | Measures practical efficiency |
| Seed and run-to-run variation | Shows whether a small apparent gain is repeatable |

For intuition: batch size determines **how much evidence is combined before the next change**, learning rate controls the scale of that change, the optimizer controls its transformation and memory, and total training exposure determines how many opportunities the model has to learn. You select these together against a measurable objective.

## 12. Understand the main training controls

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

### Learning rate: how strongly each update pushes

Learning rate scales the optimizer's update. Increasing it can adapt the model faster within a fixed token budget, but can also destabilize loss or damage useful behavior. Decreasing it can make adaptation gentler, but a rate that is too low can consume the entire budget without a useful change. Rate and exposure interact: two epochs at a lower rate are not mathematically equivalent to one epoch at a higher rate.

Choose it with a small comparison on the same data. For adapter SFT, `5e-5` versus `1e-4` is a reasonable first comparison. Look at held-out answers, not only training loss. A pretrained base and an already adapted checkpoint may respond differently; do not assume one rate is appropriate for CPT, SFT, and preference tuning.

### Batch size: memory, noise, and number of updates

The per-device microbatch controls how many sequences are in GPU memory together. Raise it when there is memory headroom and benchmark whether tokens/second improves. Lower it first when you run out of memory. Longer sequences can make the same microbatch much more expensive.

Accumulation lets you keep microbatch small while increasing the effective batch. For example, microbatch 1 with accumulation 16 and microbatch 2 with accumulation 8 both target 16 sequences per update on one GPU. They need not have exactly the same speed or numerical behavior. Padding and variable answer lengths complicate equivalence.

A larger effective batch averages over more examples and gives fewer optimizer updates per epoch. It can reduce gradient noise; it can also change convergence and require retuning the rate. Do not blindly multiply the learning rate by the GPU count. Start from a modest effective batch such as 16 or 32 sequences, record tokens per update, and change it for a concrete memory, throughput, or quality reason.

### Context length: retain what the answer needs

Inspect the token-length distribution after formatting. Choose a limit that fits the information needed to solve the task and the complete target answer. A short limit is economical but may cut away the relevant log, code, or conclusion. A long limit can waste memory if most examples are short and padding is inefficient.

For a personality-only dataset, many examples fit in 2K tokens. For multi-turn technical analysis, 4K or more may be justified. These are data-dependent choices. Increase context when important examples require it and the GPU budget allows it, rather than using 128K simply because the model advertises support.

### LoRA rank, alpha, and target modules

Rank limits the capacity of each low-rank update. Rank 16 is a modest starting point for voice changes; 32 or 64 may help a harder adaptation. More rank increases trainable parameters and optimizer state. It is useful when limited adaptation capacity is plausibly the bottleneck, not when the answer labels are wrong.

In ordinary LoRA, the update scaling involves **alpha divided by rank**. If you increase rank while keeping alpha fixed, you change both capacity and that scaling. For a first rank comparison, keep a chosen alpha/rank ratio fixed—for example, rank 16 with alpha 32 versus rank 32 with alpha 64. Rank-stabilized LoRA uses a different scaling rule, so record the variant too.

Target modules decide where the update is applied. Attention-only adapters and attention-plus-MLP adapters are different interventions. A broader language-model target set gives the adapter more places to change behavior and can cost more memory. Inspect the matched names, especially in Gemma 3's multimodal architecture. The included starter deliberately targets language attention and MLP projections while leaving the vision stack frozen.

### Regularization: dropout and weight decay

LoRA dropout randomly suppresses some adapter input activations during training. A small comparison such as 0 versus 0.05 can be useful for a small dataset showing overfitting. Too much dropout can obstruct learning. It is disabled during evaluation.

Weight decay discourages large parameter values through the optimizer's update rule. It acts on selected trainable parameters and is distinct from dropout. Neither setting can repair incorrect labels or eliminate the need for diverse data. Start with a simple documented choice and change it after you have evidence of overfitting, rather than treating regularization as an automatic quality upgrade.

### Warmup, scheduler, and clipping

Warmup ramps the rate up at the beginning. Cosine or linear decay reduces it later. A short run can spend too much of its budget warming up if you copy a large fixed warmup-step count. A fraction such as 3% is easier to interpret across pilot sizes; inspect the actual number of updates it produces.

Gradient clipping limits unusually large gradient norms. A setting of 1.0 is a common starting experiment. If clipping occurs constantly, examine the learning rate, data, and loss normalization rather than assuming clipping has made the run healthy. Sudden loss spikes can have several causes; the norm is a diagnostic, not a quality score.

### Optimizer and precision

AdamW is a straightforward baseline optimizer. Eight-bit optimizer states can save memory; CPU offload can trade GPU memory for transfer and CPU overhead. With QLoRA, optimizer state belongs mainly to the adapters, so changing the optimizer may save less than reducing activation memory.

BF16 computation generally suits modern NVIDIA training hardware. Four-bit QLoRA describes the frozen base representation; it does not mean every operation and trainable parameter uses four bits. Precision is primarily a fit, stability, and performance choice. Check that the GPU supports the selected dtype and that the trainer implements it correctly.

### Evaluation, saving, and seeds

`eval_steps` controls feedback frequency, not how much the model learns. `save_steps` controls how much progress you could lose after interruption and which intermediate candidates you retain. `save_total_limit` controls disk retention. Saving every update is expensive; saving only at the end can make an interrupted rental painful. Choose intervals that balance run duration, checkpoint size, and recovery needs.

The seed affects data ordering, adapter initialization, and other stochastic operations. Fix it when comparing settings, then vary it to assess robustness. A fixed seed does not guarantee bit-for-bit identity across hardware and library versions.

### Match the symptom to the next experiment

| Observation | First thing to inspect | A useful next change |
|---|---|---|
| Training and held-out answers both remain weak | Correct labels, template, supervised tokens, and relevant data | Better examples; then compare a higher rate or more adapter capacity |
| Training improves while held-out quality declines | Duplicates, narrow coverage, excessive exposure | Earlier checkpoint, fewer epochs, lower rate, or more diverse data |
| Voice barely changes but answers stay correct | Whether the target voice is consistent and appears without conditioning | Stronger, cleaner style demonstrations; then one rate or epoch change |
| Voice changes but factual quality falls | Altered facts in rewrites and overly narrow task mix | Correct the data; compare lower rate, fewer exposures, and broader replay |
| GPU runs out of memory | Actual peak memory and longest examples | Smaller microbatch or context, checkpointing, then a larger GPU if needed |
| GPU fits but training is slow | Padding, data loading, kernels, and utilization | Better batching/packing or a larger microbatch; benchmark each change |
| Answers stop mid-sentence | Truncation, end tokens, and generation limits | Repair preprocessing or inference settings before more training |
| Training seems fine but exported behavior changes | Base revision, template, adapter loading, quantization | Fix the export/load path and re-evaluate |

### Generation settings are a different set of controls

Temperature, top-p, and maximum generated tokens normally control inference sampling. They can make the same trained model seem more varied, repetitive, terse, or erratic. Keep them fixed during comparisons so sampling does not masquerade as a training improvement. A setting called temperature in a distillation or preference objective may have a different meaning; read that trainer's definition.

## 13. Choose full tuning, LoRA, or QLoRA

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

## 14. Evaluate the model you actually want

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

## 15. Run the first experiment

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

## 16. Build the training script

A training project is a small software pipeline: **data → tokenization → batches and loss labels → model and adapters → optimizer updates → evaluation → checkpoints → reload**. You do not implement Gemma's transformer mathematics yourself. Transformers supplies the model and training loop; PEFT supplies adapters. Your script defines exactly what data the model sees, what errors it learns from, which weights may change, and how a run can be reproduced.

### The downloadable starter

This guide now includes an inspectable implementation, three configurations, small format examples, preprocessing tests, and a reload script. [Open the complete training folder on GitHub](https://github.com/standrze/field-guides/tree/main/gemma-cyber-training/training). Read the [setup and limitations](https://github.com/standrze/field-guides/blob/main/gemma-cyber-training/training/README.md) before renting compute.

**Validation status:** Python syntax, command-line help, and eight dependency-free preprocessing tests were checked locally. No Gemma weights were trained. Real tokenizer integration, CUDA memory, training, checkpoint recovery, and exported generation still need a GPU smoke test. The package pins are a starting environment, not a GPU-qualified lock.

| File | What it controls |
|---|---|
| [train_gemma.py](./training/train_gemma.py) | Loads the model, attaches adapters, configures Trainer, records lineage, and saves outputs |
| [data_utils.py](./training/data_utils.py) | Validates records, creates token IDs and loss labels, and pads batches |
| [cpt.json](./training/configs/cpt.json) | PT checkpoint plus the text objective |
| [sft-after-cpt.json](./training/configs/sft-after-cpt.json) | Continues the CPT adapter on the same PT base with assistant-response training |
| [personality.json](./training/configs/personality.json) | Creates a fresh personality adapter on the IT checkpoint |
| [requirements.txt](./training/requirements.txt) | Explicit starting package versions |
| [test_data.py](./training/test_data.py) | Checks masking, padding, document boundaries, and input validation |
| [reload_adapter.py](./training/reload_adapter.py) | Loads the export in a new process and generates a deterministic answer |

The scope is deliberately specific: one NVIDIA GPU with BF16 support, Linux, Python 3.11, text-only QLoRA, and official Gemma 3 4B/12B/27B checkpoints. The full conditional-generation model is loaded, including the frozen vision components. Only language-model adapter parameters train. This implementation does not cover image data, full-weight CPT, distributed training, or preference optimization.

### 1. Prepare the rental environment

You need a GPU driver compatible with the PyTorch CUDA runtime, sufficient VRAM, system RAM for loading/tokenization, persistent disk for model cache and checkpoints, and accepted access conditions for the chosen Gemma repository. An A100 80 GB is a candidate to benchmark at short context; it is not a fit guarantee for every configuration. Quantized model size alone does not include activations, logits, workspace, adapters, or optimizer state.

From verified persistent storage on the rental:

```bash
git clone https://github.com/standrze/field-guides.git
cd field-guides/gemma-cyber-training/training
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
hf auth login
nvidia-smi
python -m pip check
python -m unittest -v test_data
```

Use a new virtual environment. This avoids inheriting an incompatible vision package or unrelated training dependency from the Pod image. After the GPU smoke test succeeds, record the container image, driver, Python version, and `pip freeze` output. A requirements file with several pinned libraries still leaves transitive dependencies unpinned.

### 2. Give each objective the right data

CPT reads JSONL: one JSON object per line, containing one document.

```json
{"text":"A restoration exercise checks whether a backup can restore the service and whether the recovered data is usable."}
```

SFT reads conversations. A personality example has the same schema; the desired style appears in the assistant answer.

```json
{"messages":[{"role":"user","content":"Be concise and calm. Does a failed login prove compromise?"},{"role":"assistant","content":"No. A failed login alone does not prove compromise. Check for successful logins and corroborating account activity before drawing a conclusion."}]}
```

The supplied example files are invented format fixtures. Two short examples are enough to exercise a loader, not enough to train a useful specialist or assess personality. Substitute your reviewed corpus and separate held-out data. Split related documents and conversation families together before tokenization; exact duplicate detection does not catch paraphrases or shared answers.

### 3. Understand the three arrays

| Array | Meaning | Common mistake |
|---|---|---|
| `input_ids` | Token numbers for everything the model reads | Adding BOS twice or using the wrong chat format |
| `attention_mask` | Which positions contain actual input versus padding | Treating padding as real context |
| `labels` | Token targets used to calculate prediction error; `-100` means ignore | Training on user text unintentionally or masking away the entire answer |

For CPT, ordinary document tokens contribute to next-token loss. For SFT in this starter, the prompt is visible context, but only the final assistant response and its turn ending contribute to loss. The model internally shifts logits and labels for next-token prediction; you should not shift them a second time in your dataset.

Conceptually, the SFT example becomes:

```text
Input:  [BOS] [user header] question [turn end] [model header] answer [turn end]
Loss:   ignore............................................. learn...........
```

The helper renders the prompt prefix and full conversation separately and asserts that their token prefixes match before constructing the mask. It rejects overlong SFT examples instead of silently truncating the desired answer. Its padding logic masks padding positions, preserving genuine end tokens even if a tokenizer uses the same ID for padding and EOS.

### 4. Preserve Gemma's format

Gemma has native user/model turn markers. The starter uses a saved, minimal text chat template, converting the dataset's `assistant` role into the native `model` header. It accepts alternating user/assistant string messages. Put high-level instructions in the first user message; this minimal implementation does not accept a separate system role, tools, or images. More capable processor templates may transform those inputs, but that is a separate integration. [Google's formatting guide](https://ai.google.dev/gemma/docs/core/prompt-structure)

Earlier assistant replies in a multi-turn record are context only. To train every reply, create separate prefixes ending at each assistant answer and keep all prefixes from a conversation in one dataset split. At inference, use the tokenizer/template saved with the adapter and stop on the end-of-turn token as well as EOS. A different serving template can make a correctly trained adapter appear broken.

### 5. Load and adapt the exact model

The loader resolves the chosen repository revision to an immutable commit. It loads `Gemma3ForConditionalGeneration`, quantizes the frozen base to NF4 with double quantization and BF16 compute, and prepares it for adapter training. It selects attention and MLP projections **within the language model**, attaches LoRA, and asserts that only those adapter parameters are trainable. These choices follow the relevant model and quantization APIs. [Gemma 3 API](https://huggingface.co/docs/transformers/v4.57.1/en/model_doc/gemma3), [PEFT quantized training](https://huggingface.co/docs/peft/v0.17.0/en/developer_guides/quantization)

The starter disables the training KV cache and enables gradient checkpointing to reduce activation memory. It uses one explicit GPU; `device_map="auto"` is not a substitute for a designed multi-GPU training setup. If you need distributed full tuning, the memory, sharding, checkpointing, and launch architecture all change.

### 6. Translate settings into actual updates

The JSON config exposes the controls explained in the earlier chapters: learning rate, epochs, microbatch, accumulation, context, rank, alpha, dropout, weight decay, warmup, evaluation/save intervals, and seed. Paths in the config are relative to the config file. CLI output/checkpoint paths are relative to your shell's current directory.

With microbatch 1, accumulation 16, and one GPU, a full optimizer update incorporates 16 sequences. `--max-steps 5` means five optimizer updates, not five examples or five epochs; it overrides the epoch budget. The final incomplete accumulation group can be smaller. The pinned Gemma implementation computes mean loss per microbatch; the script tells Trainer to scale accumulation accordingly. With variable answer lengths, equal microbatch weighting is not identical to global token weighting. Keep that convention fixed when comparing runs.

Evaluation and checkpoint intervals count optimizer updates. Saving every 50 updates creates no periodic checkpoint during a five-update test, so the smoke-test config must use a smaller interval. Save frequency changes recoverable work and I/O overhead; it does not directly make the model learn more. [Trainer arguments and behavior](https://huggingface.co/docs/transformers/v4.57.1/en/main_classes/trainer)

### 7. Validate cheaply, then run

First validate formatting without downloading the weights:

```bash
python train_gemma.py --config configs/personality.json --prepare-only
```

This still requires authorized tokenizer/config access. It reports input tokens, supervised tokens, sequence counts, maximum lengths, and the resolved base commit. Replace `revision: "main"` in your real configs with that SHA so later stages cannot silently use a changed base.

For a GPU smoke test, copy the desired config to `configs/smoke.json`, use a small disjoint dataset, set context to 512 and both evaluation/save intervals to 2:

```bash
python train_gemma.py --config configs/smoke.json \
  --max-steps 5 --output-dir runs/smoke

python reload_adapter.py runs/smoke/adapter-final \
  --prompt "What should a backup restoration test verify?"

python train_gemma.py --config configs/smoke.json \
  --max-steps 5 --output-dir runs/smoke \
  --resume runs/smoke/checkpoint-4
```

Check finite loss/gradients, adapter parameter names, peak memory, export files, generation, and successful recovery from step four. Resuming here recovers the original five-step schedule; it does not add five new steps. Five updates can expose plumbing problems but cannot establish model quality. A preliminary 4B test reduces debugging cost, but you must still measure 27B memory and speed.

After passing the technical checks, run your actual data budget in a fresh output directory:

```bash
# Knowledge route: the SAME PT base plus a continuously updated adapter.
python train_gemma.py --config configs/cpt.json
python train_gemma.py --config configs/sft-after-cpt.json

# Separate personality-only route: fresh adapter on IT.
python train_gemma.py --config configs/personality.json
```

The second CPT-route command is appropriate only after evaluating/selecting the CPT result. Its example config points to the final adapter for convenience. A selected earlier checkpoint must be exported with its tokenizer and matching manifest before setting `initial_adapter`.

### 8. Keep three operations distinct

| Operation | What gets loaded | Optimizer behavior |
|---|---|---|
| Resume an interrupted run | Same model, adapter, data, configuration, and full Trainer checkpoint | Restores saved optimizer/scheduler/step state |
| Start SFT after CPT | Exact original PT base plus the selected CPT adapter | Starts a new optimizer/scheduler for the new objective |
| Start an independent personality experiment | Original IT base plus a fresh adapter | Starts from scratch for that experiment |

Do not attach a CPT adapter trained on PT to the IT model merely because both say 27B. Do not reset the CPT adapter before SFT and accidentally discard its learned changes. For the simple sequential route, the same adapter continues training and keeps its rank, alpha, and dropout.

Periodic `checkpoint-N` folders are resumable training artifacts. `adapter-final` is an inference adapter with a tokenizer and manifest, not a standalone 27B model and not the entire optimizer state. The starter exports the final adapter; selection of the best model remains an evaluation decision.

### What to fix when it fails

| Symptom | First useful check |
|---|---|
| Access denied while downloading | Gemma license acceptance, exact repository, token permission |
| Out of memory before updates | Loading precision, free VRAM, base/vision/head memory, other processes |
| Out of memory during updates | Context and microbatch first; then rank/targets and implementation memory overhead |
| Loss is zero, NaN, or never meaningful | Supervised token count, masks, data, precision, gradients and learning rate |
| It repeats prompts or writes both roles | Chat template, assistant-only labels, and generation stop tokens |
| Adapter loads but behavior is wrong | Exact base revision, exported tokenizer/template, adapter activation |
| Resume rejects the run | Dataset hashes, original config, full checkpoint path and unchanged total budget |
| Good training loss, weak held-out answers | Data coverage, contamination, overfitting, and quality of answer supervision |

For a larger CPT corpus, replace the eager Python-list dataset with a tested streaming or Arrow pipeline and explicit packing. For DPO, add preference pairs and a suitable trainer. For personality alone, use the IT/SFT config and judge both style and unchanged task competence. The training script supplies mechanics; your examples and evaluations define the behavior worth learning.

## 17. Use Runpod for rented GPU training

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

Use the files and launch commands in the training-script chapter for this guide’s starter. Complete its GPU smoke test before scheduling a long Pod run. Google also links supported Gemma tuning frameworks from its tuning guide if you prefer another implementation. [Google tuning entry point](https://ai.google.dev/gemma/docs/tune)

Use a persistent terminal session or job launcher so disconnecting the browser does not end your work. Record loss, gradients, GPU memory, token throughput, and evaluation results. Save a resumable checkpoint to persistent storage and verify that a new process can reload it before starting a long rental.

After the run, upload the selected export and copy the training records. Verify the remote files before terminating the Pod. Disconnecting your SSH session does not stop the GPU bill. Stopping compute can leave storage charges; deletion has different consequences for the volume types.

## 18. Use Hugging Face tools and Jobs

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

The following is a **separate Jobs launch template** for a dependency-declared `train.py` UV script. It does not directly launch this guide’s multi-file starter: package that folder and its data/configs into a compatible container or adapt it into a self-contained UV script first. Replace `USERNAME` and the job identifier, and make sure the script accepts the shown `--output_dir` argument.

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

## 19. Export and keep the training lineage

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

## 20. What other Gemma trainers reported

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

## 21. Sources and evidence notes

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

## 22. Current rental prices

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

## 23. Build your experiment budget

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
