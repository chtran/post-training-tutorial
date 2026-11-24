https://huggingface.co/thinkingmachines/Inkling-2-Small/blob/main/README.md

Hugging Face
Search models, datasets, users...
Ctrl K
Models
Datasets
Spaces
Docs
Pricing
Website
Tasks
HuggingChat
Collections
Languages
Organizations
Community
Blog
Posts
Daily Papers
Hardware
Learn
Discord
Forum
GitHub
Solutions
Team & Enterprise
Hugging Face PRO
Enterprise Support
Inference Providers
Inference Endpoints
Storage Buckets
Log In
Sign Up
thinkingmachines
/
Inkling-2-Small 
Like
1.46k
Follow
Thinking Machines Lab
3.43k
Image-Text-to-Text
Transformers
Safetensors
inkling2
conversational
Mixture of Experts
Eval Results
8-bit precision
modelopt
License:
apache-2.0
Model card
Files
xet
Community
15
Deploy
Copy to bucket
Use this model
Instructions to use thinkingmachines/Inkling-2-Small with libraries, inference providers, notebooks, and local apps. Follow these links to get started.
Libraries
Transformers

How to use thinkingmachines/Inkling-2-Small with Transformers:

# Use a pipeline as a high-level helper
from transformers import pipeline

pipe = pipeline("image-text-to-text", model="thinkingmachines/Inkling-2-Small")
messages = [
    {
        "role": "user",
        "content": [
            {"type": "image", "url": "https://huggingface.co/datasets/huggingface/documentation-images/resolve/main/p-blog/candy.JPG"},
            {"type": "text", "text": "What animal is on the candy?"}
        ]
    },
]
pipe(text=messages)
# pip install -U transformers accelerate
# Load model directly
from transformers import AutoProcessor, AutoModelForMultimodalLM

processor = AutoProcessor.from_pretrained("thinkingmachines/Inkling-2-Small")
model = AutoModelForMultimodalLM.from_pretrained("thinkingmachines/Inkling-2-Small", device_map="auto")
messages = [
    {
        "role": "user",
        "content": [
            {"type": "image", "url": "https://huggingface.co/datasets/huggingface/documentation-images/resolve/main/p-blog/candy.JPG"},
            {"type": "text", "text": "What animal is on the candy?"}
        ]
    },
]
inputs = processor.apply_chat_template(
	messages,
	add_generation_prompt=True,
	tokenize=True,
	return_dict=True,
	return_tensors="pt",
).to(model.device)

outputs = model.generate(**inputs, max_new_tokens=256)
print(processor.decode(outputs[0][inputs["input_ids"].shape[-1]:]))
Inference
Inference Providers
HuggingChat
Notebooks
Google Colab
Kaggle
Local Apps
Settings
vLLM

How to use thinkingmachines/Inkling-2-Small with vLLM:

Install from pip and serve model
# Install vLLM from pip:
pip install vllm
# Start the vLLM server:
vllm serve "thinkingmachines/Inkling-2-Small"
# Call the server using curl (OpenAI-compatible API):
curl -X POST "http://localhost:8000/v1/chat/completions" \
	-H "Content-Type: application/json" \
	--data '{
		"model": "thinkingmachines/Inkling-2-Small",
		"messages": [
			{
				"role": "user",
				"content": [
					{
						"type": "text",
						"text": "Describe this image in one sentence."
					},
					{
						"type": "image_url",
						"image_url": {
							"url": "https://cdn.britannica.com/61/93061-050-99147DCE/Statue-of-Liberty-Island-New-York-Bay.jpg"
						}
					}
				]
			}
		]
	}'
Use Docker
docker model run hf.co/thinkingmachines/Inkling-2-Small
SGLang

How to use thinkingmachines/Inkling-2-Small with SGLang:

Install from pip and serve model
# Install SGLang from pip:
pip install sglang
# Start the SGLang server:
python3 -m sglang.launch_server \
    --model-path "thinkingmachines/Inkling-2-Small" \
    --host 0.0.0.0 \
    --port 30000
# Call the server using curl (OpenAI-compatible API):
curl -X POST "http://localhost:30000/v1/chat/completions" \
	-H "Content-Type: application/json" \
	--data '{
		"model": "thinkingmachines/Inkling-2-Small",
		"messages": [
			{
				"role": "user",
				"content": [
					{
						"type": "text",
						"text": "Describe this image in one sentence."
					},
					{
						"type": "image_url",
						"image_url": {
							"url": "https://cdn.britannica.com/61/93061-050-99147DCE/Statue-of-Liberty-Island-New-York-Bay.jpg"
						}
					}
				]
			}
		]
	}'
Use Docker images
docker run --gpus all \
    --shm-size 32g \
    -p 30000:30000 \
    -v ~/.cache/huggingface:/root/.cache/huggingface \
    --env "HF_TOKEN=<secret>" \
    --ipc=host \
    lmsysorg/sglang:latest \
    python3 -m sglang.launch_server \
        --model-path "thinkingmachines/Inkling-2-Small" \
        --host 0.0.0.0 \
        --port 30000
# Call the server using curl (OpenAI-compatible API):
curl -X POST "http://localhost:30000/v1/chat/completions" \
	-H "Content-Type: application/json" \
	--data '{
		"model": "thinkingmachines/Inkling-2-Small",
		"messages": [
			{
				"role": "user",
				"content": [
					{
						"type": "text",
						"text": "Describe this image in one sentence."
					},
					{
						"type": "image_url",
						"image_url": {
							"url": "https://cdn.britannica.com/61/93061-050-99147DCE/Statue-of-Liberty-Island-New-York-Bay.jpg"
						}
					}
				]
			}
		]
	}'
Docker Model Runner

How to use thinkingmachines/Inkling-2-Small with Docker Model Runner:

docker model run hf.co/thinkingmachines/Inkling-2-Small
main
Inkling-2-Small
/
README.md 
marstin-thinky
[surge-update] update DAYJOB (Finance) and DAYJOB (Healthcare) for Inkling 2 Small (#10)
4d56448
5 days ago
Preview
Code
|
Download
Download README.md from thinkingmachines/Inkling-2-Small: direct link, hf CLI and curl.
Browser
Download file
129 kB
Copy download link
https://huggingface.co/thinkingmachines/Inkling-2-Small/resolve/main/README.md
Command line
Copy hf CLI command
hf download hf://thinkingmachines/Inkling-2-Small/README.md
Copy curl command
curl -L -o README.md https://huggingface.co/thinkingmachines/Inkling-2-Small/resolve/main/README.md
Raw
History
Blame
Contribute
Delete
Safe
129 kB
metadata
license: apache-2.0
license_link: https://www.apache.org/licenses/LICENSE-2.0
pipeline_tag: image-text-to-text
tags:
  - conversational
  - image-text-to-text
  - moe
library_name: transformers

Inkling 2 Small

NVFP4 | MXFP8 | Playground | Tinker Cookbook | Acceptable Use

1. General Information

Inkling 2 Small is a general-purpose multimodal model that accepts text and image inputs and generates text outputs. It is intended for use in English and other languages, and across multiple coding languages. The model is designed to be used by developers building AI-powered applications, including agentic and tool-use systems, coding assistants, chatbots, and retrieval-augmented generation systems, and is suitable for general-purpose conversational use, instruction-following, and other natural language and visual tasks. It is released with open weights to support research, fine-tuning and integration into third-party products by downstream developers.

Languages: English, with general multilingual capabilities across other languages.

2. Getting Started

Try Inkling 2 Small on the Tinker Playground or access via API using the Tinker Cookbook. To fine-tune Inkling 2 Small with Tinker, also install the tml-renderers package.

Inkling 2 Small supports local inference using:

SGLang (recipe)
vLLM (recipe)
TokenSpeed (recipe)
Unsloth (recipe)

Inkling 2 Small can also be post-trained with:

Miles
SkyRL
Snowflake Cortex Training

API access is also available through third party inference providers, including:

NVIDIA
Fireworks
Together
Baseten
Nebius
Modal
Cloudflare
Required hardware

The model is distributed in two checkpoint formats.

The main NVFP4 checkpoint requires a GPU cluster with at least 500GB of aggregated VRAM. This can be met with either of the following example configurations:

2x NVIDIA B300 GPUs
4x NVIDIA H200 GPUs

The alternative MXFP8 checkpoint requires a GPU cluster with at least 800GB of aggregated VRAM. This can be met with either of the following example configurations:

4x NVIDIA B300 GPUs
8x NVIDIA H200 GPUs

The model was pretrained, midtrained and post-trained in NVFP4, so this is the native precision for the model. We recommend the NVFP4 checkpoint for all use-cases, and we're confident that it's the best option. The MXFP8 has a very marginal 1–2 percentage points gain over the NVFP4 checkpoint over evals, but we do not think it is meaningful for any practical use-cases.

Required software

Running the model directly on GPU hardware requires an inference deployment framework — either SGLang, vLLM, TokenSpeed, Unsloth, or Hugging Face, along with all of their respective dependency libraries.

3. Model Properties
Model type

Multimodal autoregressive transformer

Architecture type

A 48-layer decoder-only transformer with a sparse Mixture-of-Experts (MoE) feed-forward backbone: each token is routed to 8 of 384 experts. Attention is a hybrid of local and global layers. The model is natively multimodal — images are encoded via a vision transformer — with image and text inputs projected into a shared hidden space and processed jointly by the decoder.

Parameters

594B total, 17B active

Numerics support

MXFP8 and NVFP4

Input modalities

Inkling 2 Small accepts text input in UTF-8 encoding and image input in any pixel-based format (with each dimension ideally between 40px and 4096px for optimal performance). It supports a context window of up to 1M tokens.

Output modalities

Inkling 2 Small generates output as UTF-8 encoded text.

4. Training

Training data includes a broad variety of content types, including text, images, video. Training data for the model was drawn from publicly available sources, acquired from third-parties, generated internally, or synthetically generated or augmented. Publicly available data includes content from the public internet and publicly accessible repositories.

The training data curation process includes cleaning, processing, and modifying datasets. These processing steps, which vary by data type, may include deduplication and filtering to remove junk or other low-quality data, or to advance safety or other objectives.

5. Evaluations
	Open Weights Flash	Open Weights Pro	Closed Weights Flash
	Inkling 2 Small	GLM-5.3-Flash	MiMo V2.6 Flash	MiniMax-M3.1-Flash	DeepSeek-V4.1-Flash-1017	Muse Spark Open	GLM 5.3	MiMo V2.6 Pro	Mistral Large 4	Kimi K3	GPT-6 Luna	Gemini 3.8 Flash	Claude Haiku 5.5
Model Info													
Params (B)
activated / total	17/594	18/320	15/309	23/428	16/552	42/816	40/753	42/1020	49/1050	104/2800	–	–	–
Third Party Index													
AA Index (v5.0)	30.6	27.8	26.7	29.1	
32.6
	24.9	31.7	29.9	26.1	–	27.9	30.8	
36.5

Vals Index (v2.2)	56.1%	50.9%	54.8%	53.8%	
61.3%
	48.6%	
59.7%
	57.8%	56.5%	53.0%	52.3%	56.0%	58.7%
Coding													
FrontierCode v2.0
stirrup v0.2.1	25.4%	17.6%	21.6%	20.8%	
28.5%
	7.6%	21.6%	24.0%	15.0%	17.3%	25.2%	18.7%	
34.9%

DeepSWE v1.1
mini-swe-agent v2.4.6	72.1%	63.4%	67.9%	73.7%	
77.0%
	60.0%	69.0%	71.9%	61.7%	68.5%	66.6%	
73.8%
	59.9%
Terminal Bench Science v0.1
mini-swe-agent v2.4.6	5.7%	4.8%	4.3%	3.3%	
12.9%
	1.9%	9.5%	5.7%	4.3%	8.1%	8.6%	10.0%	
20.0%

Vibe Code Bench v1.1
openhands (vals)	81.6%	30.8%	79.0%	73.9%	
87.7%
	76.2%	78.1%	85.2%	81.6%	85.0%	81.7%	78.7%	
90.4%

SWE-Atlas v1.1
mini-swe-agent v2.4.6	
61.9%
	–	–	–	
62.1%
	42.3%	–	–	–	61.0%	50.8%	57.3%	59.4%
SWEBench Pro v2 (Hard)
mini-swe-agent v2.4.6	86.3%	82.8%	
89.7%
	84.3%	
89.7%
	82.4%	84.3%	89.2%	83.8%	88.2%	88.7%	58.8%	52.9%
Sudo L7	
14.1%
	–	–	–	–	–	9.4%	–	
13.9%
	12.2%	–	10.6%	–
Autoresearch													
PostTrainBench v1.2
Inkling 2 Small in Claude Code	31.9%	
36.8%
	–	–	30.5%	–	
34.5%
	–	–	31.5%	–	–	–
PMPP-Hard (AUC, 0–10h)
pi v0.83.0	
494.27
	–	–	–	
497.36
	–	430.96	–	478.39	453.58	–	–	–
BioMysteryBench
terminus v2	70.0%	–	69.3%	–	–	–	–	–	–	
72.6%
	61.5%	62.2%	
70.4%

Search and Tools													
BrowseComp
Inkling 2 Small with compaction	
90.2%
	76.0%	78.1%	69.5%	87.8%	68.7%	75.1%	–	84.5%	88.4%	83.6%	
89.4%
	80.2%
DeepSearchQA
Inkling 2 Small with compaction	
90.9%
	84.3%	86.0%	82.7%	84.5%	80.4%	84.7%	90.0%	84.4%	
95.0%
	83.5%	90.1%	83.2%
MCP Atlas
Full / Public	
85.4/85.0%
	–/82.0%	–/62.9%	–/80.4%	–/83.2%	
89.2/87.5%
	84.2/83.6%	–/84.4%	–/84.5%	82.3/84.2%	–/77.8%	–/87.5%	–/81.0%
Knowledge Work													
AA-Briefcase v1.1	1527	1451	1487	1476	
1570
	1279	1503	1512	1348	1497	1337	1203	
1574

GDPVal-AA v2.1	1630	1649	1614	1465	
1746
	1401	1657	
1689
	1384	1543	1444	1445	1631
JobBench	
70.5%
	60.7%	61.2%	67.5%	
68.5%
	61.8%	61.4%	62.0%	55.2%	54.3%	49.0%	63.4%	39.2%
DAYJOB (Healthcare)	
11.2%
	1.2%	–	–	
6.0%
	–	4.4%	–	3.6%	4.0%	1.2%	2.0%	–
Enterprise Operations													
EnterpriseOps-Gym	
46.8%
	33.2%	29.0%	
48.9%
	43.6%	43.1%	36.4%	38.0%	44.9%	45.3%	24.9%	45.7%	25.1%
EnterpriseBench-CoreCraft	
71.8%
	46.7%	–	–	
58.5%
	–	51.8%	–	47.7%	43.1%	43.1%	
58.5%
	–
Finance Work													
Finance Agent v2.1	
67.5%
	60.6%	63.3%	58.8%	62.9%	60.7%	65.0%	64.3%	61.7%	60.0%	56.8%	
65.8%
	65.4%
Excel Modeling Benchmark v1.1	69.5%	66.3%	68.9%	67.8%	69.2%	62.0%	69.1%	67.4%	68.7%	
71.3%
	70.0%	
72.9%
	65.5%
Tax Agent Bench	38.9%	31.6%	28.5%	32.1%	
44.4%
	26.3%	
39.7%
	32.4%	30.7%	33.4%	19.9%	32.1%	31.9%
Apex-Accounting v1.1
pass@1	14.5%	12.3%	–	13.5%	12.5%	13.8%	13.9%	–	12.0%	9.5%	10.8%	
15.5%
	
15.3%

DAYJOB (Finance)	
13.8%
	7.3%	–	–	
12.5%
	–	11.0%	–	4.8%	5.5%	6.8%	4.5%	–
DeepFinance	
29.8%
	–	–	–	–	–	27.5%	–	21.5%	–	26.4%	–	
40.0%

Diligence Bench
Best harness	
58.1%
	48.3%	–	51.6%	50.4%	
59.0%
	49.4%	51.8%	51.5%	50.9%	42.1%	51.1%	40.8%
AA-AnalystAgent	
51.2%
	25.0%	–	–	–	–	38.8%	37.5%	–	38.8%	43.8%	46.3%	
53.8%

Tau 3 Banking v1.0.1	
40.4%
	
47.2%
	–	–	–	–	–	–	–	33.4%	–	–	–
ATLAS-Finance v1.1	
6.0%
	–	–	–	–	–	3.0%	–	–	
3.7%
	–	
3.7%
	–
Legal Work													
Harvey LAB v1.1	
21.7%
	10.4%	13.3%	7.5%	14.2%	
25.0%
	14.6%	13.8%	15.8%	12.9%	4.2%	12.1%	4.2%
Legal Research Bench	46.6%	45.2%	38.0%	34.1%	45.2%	38.5%	
49.0%
	
47.1%
	35.6%	46.2%	30.3%	38.9%	43.8%
Visual Creation													
DesignArena Web Apps	
1286
	–	–	–	–	–	1271	1274	–	
1280
	1160	1224	–
DesignArena Website	
1331
	1266	–	1275	1296	1300	1285	1303	1253	
1330
	1265	1295	1257
DesignArena Game Dev	
1424
	1270	–	1307	1261	1254	1292	1309	1218	
1351
	1254	1298	1314
DesignArena 3D Design	
1457
	1300	–	1319	1344	1255	1304	1322	1239	
1367
	1199	1279	1329
Code Arena (WebDev)	1653	1607	1637	1582	
1665
	–	1623	1625	1544	
1656
	1579	1583	1589
AA-3D	
1021
	937	–	–	–	–	782	977	–	982	–	965	
994

Code2Video-AA	1020	975	
1052
	–	–	–	1034	
1052
	–	1041	1030	899	
1192

BVB	
71.6%
	67.9%	–	–	70.0%	–	–	–	–	–	
70.3%
	65.9%	68.4%
Visual Perception													
PerceptionBench	
64.7%
	49.6%	39.1%	47.1%	47.7%	44.1%	–	38.9%	46.5%	58.5%	56.2%	
68.7%
	60.5%
Humanity’s Sixth Sense	
33.3%
	26.8%	25.4%	–	30.1%	29.6%	–	25.2%	–	25.5%	21.0%	
41.6%
	–
BabyVision
original / with Python	
68.6/93.6%
	53.4/84.0%	16.9/68.4%	56.1/91.0%	44.9/92.5%	44.3/80.2%	–	19.0/73.8%	42.3/71.0%	53.4/85.7%	55.3/79.6%	
72.8/92.8%
	48.3/93.9%
ScreenSpot Pro
original / with Python	
83.8/92.0%
	–/85.3%	35.4/72.5%	48.5/76.8%	–	–	–	56.6/79.7%	42.3/43.4%	73.8/86.1%	81.1/87.7%	65.7/93.7%	
85.4/88.7%

OmniDocBench v1.6	
94.6%
	92.3%	87.4%	92.0%	91.9%	93.8%	–	88.4%	90.2%	
95.2%
	92.3%	89.7%	92.6%
SimpleVQA
with search and tools	
68.2%
	67.1%	–	–	–	63.6%	–	–	57.8%	
68.5%
	–	–	–
Visual Reasoning													
GDP.pdf	
25.2%
	15.4%	9.0%	20.8%	17.2%	18.6%	11.2%	19.2%	17.6%	22.0%	
22.8%
	21.0%	20.8%
MMMU Pro
Standard 10	
81.6%
	79.0%	67.8%	79.1%	80.6%	80.9%	–	74.1%	78.0%	80.5%	79.7%	
85.6%
	79.1%
Charxiv RQ
original / with Python	
85.6/89.1%
	80.2/89.4%	66.2/88.4%	82.5/87.6%	77.0/89.6%	85.4/89.5%	–	74.2/86.7%	83.2/87.4%	84.8/91.3%	81.8/87.6%	
86.2/92.4%
	84.4/86.3%
Chartography
original / with Python	36.7/82.1%	16.3/78.0%	7.5/73.9%	12.6%/–	17.9/83.0%	35.7/65.8%	–	10.8/69.0%	21.2/55.2%	26.6/66.6%	32.0/66.5%	
40.9/81.0%
	
46.4/86.2%

VIALS
original / with stirrup v0.2.1	
34.6/57.8%
	–/53.0%	–	–/49.7%	–/53.2%	–	–	–/58.4%	–/42.0%	
20.9%/–
	–/44.1%	–/52.0%	–/60.5%
SAGE v1.1	88.6%	
89.3%
	83.3%	85.3%	–	85.8%	–	84.4%	–	86.8%	83.4%	88.2%	
89.8%

MuirBench	
79.2%
	71.6%	63.2%	69.4%	75.7%	74.5%	–	72.6%	67.5%	77.0%	73.9%	
80.1%
	74.0%
ZeroBench (main)
original / with Python	
29.0/44.0%
	13.0/32.0%	7.0%/–	21.0%/–	
23.0%/–
	14.0/50.0%	–	8.0%/–	15.0/23.0%	
23.0/41.0%
	16.0%/–	
23.0%/–
	
23.0%/–

STEM Reasoning													
CritPt v2
Full / Hard	55.7/35.0%	–/24.5%	–/29.5%	51.4/32.5%	50.6/25.0%	52.6/29.5%	57.4/33.5%	56.9/34.0%	50.3/27.0%	–/40.5%	
65.1/42.5%
	
65.1/46.5%
	64.0/43.5%
HLE-Diamond	28.7%	18.2%	13.7%	28.1%	25.3%	26.3%	17.9%	15.2%	17.3%	26.9%	22.2%	
33.1%
	
29.6%

HLE (text only)	44.1%	39.9%	35.1%	
48.0%
	43.3%	43.9%	42.3%	
49.4%
	36.4%	46.9%	38.5%	47.8%	44.4%
ArxivMath
10/2026	
27.7%
	–	–	–	
38.3%
	19.2%	–	–	18.1%	–	–	–	–
BrokenArxiv
10/2026	
63.3%
	–	–	–	
49.7%
	33.3%	–	–	30.6%	–	–	–	–
ARC-AGI-1	
96.5%
	91.0%	–	–	93.5%	89.0%	–	–	–	94.5%	86.7%	
98.5%
	89.0%
ARC-AGI-2	
81.7%
	65.8%	–	–	78.1%	57.5%	–	–	–	60.4%	59.3%	
89.2%
	61.3%
MysteryMechanism	25.2%	–	21.6%	–	–	–	23.0%	15.3%	–	–	19.4%	
36.5%
	
35.1%

Long Context													
AA-LCR v1.1	83.3%	80.0%	74.3%	79.7%	82.7%	78.3%	79.7%	
86.3%
	78.0%	
88.7%
	83.3%	81.3%	82.7%
LongBench v2	
70.6%
	68.2%	60.7%	60.9%	69.0%	68.7%	68.4%	68.0%	65.7%	69.0%	65.0%	
73.7%
	65.3%
Factuality													
AA-Omniscience v1.1
score	16.1	0.7	-10.8	-6.4	0.9	
25.8
	6.0	-4.5	5.1	–	-8.3	
23.3
	12.3
AA-Omniscience v1.1
non-hallucination rate	
73.3%
	61.7%	47.8%	6.3%	35.9%	
72.0%
	61.1%	39.8%	71.8%	–	20.7%	44.9%	65.8%
Instruction Following													
ComplexConstraints v1.0	44.5%	27.6%	22.1%	23.2%	
50.4%
	41.3%	30.5%	32.3%	36.5%	37.9%	27.3%	
48.4%
	36.8%
Multilinguality													
Global-MMLU-Lite	91.0%	89.0%	83.9%	78.5%	90.4%	
91.2%
	89.8%	88.0%	88.0%	90.6%	90.2%	
93.2%
	87.8%
MDPBench	81.4%	70.9%	54.7%	69.2%	68.8%	
82.0%
	–	67.0%	64.3%	
83.6%
	71.2%	81.5%	78.4%
Safety													
HoneyBench v0.2 (↓)	
52.6%
	–	–	–	
76.4%
	85.6%	76.8%	–	83.6%	78.5%	–	80.5%	–
DistressBench	
82.0%
	72.7%	–	–	–	
87.7%
	72.5%	–	77.0%	73.5%	66.7%	70.7%	71.7%
FORTRESS (adversarial)	83.8%	73.3%	64.7%*	47.9%	72.8%	
92.4%
	71.8%	69.9%*	76.0%	73.4%	89.2%	79.5%*	
90.5%

FORTRESS (benign)	79.7%	96.4%	
97.4%*
	96.8%	93.1%	84.0%	96.8%	97.1%*	91.8%	
97.3%
	92.4%	94.8%*	91.0%
StrongREJECT (none)	97.1%	97.8%	97.8%	97.4%	
99.4%
	97.1%	97.5%	99.0%	99.0%	99.0%	
99.4%
	93.0%	97.8%
Cybersecurity													
CyberBench v1.1	72.7%	67.9%	75.4%	–	–	–	72.1%	72.9%	–	75.2%	
76.3%
	43.8%	
75.5%

PatchEval	79.6%	74.8%	77.0%	76.5%	
80.4%
	77.8%	69.6%	80.0%	76.1%	77.0%	76.5%	77.8%	
81.7%

Best reported score in each row (lowest where lower is better); equal displayed scores tie Second-best reported score in each row; none when first place is tied

* On public split only.

For ScreenSpot Pro evaluation, images whose long side exceed 4,096 pixels are downsampled to that limit while preserving the aspect ratio; the ground truth answers were rescaled accordingly. Smaller images remain unchanged.

6. Safety

We conducted safety evaluations ahead of release, spanning both everyday human-AI interaction and dangerous-capability testing. Because Inkling 2 Small is multimodal, we paid attention to whether safety behavior held consistently across text and image inputs. We applied mitigations to reduce risks before release.

For everyday interaction, we evaluated sycophancy, harmful manipulation, and psychological-harm patterns like parasocial dependency and validation of delusional reasoning, including through multi-turn, open-ended external red-teaming designed to surface issues that only emerge over longer conversations. We also assessed whether the model refuses genuinely harmful requests without over-refusing benign ones. For CBRN and cyber, we assessed knowledge and procedural uplift through internal evaluations, external testing, and refusal-suppressed variants intended to estimate latent capability with safeguards removed. For loss of control, we evaluated agentic capability, strategic deception, and sabotage potential, benchmarked against public frontier models, and found the model materially below frontier capabilities.

Across all areas, we concluded that Inkling 2 Small did not present risk of material uplift beyond what's already available in the open-weight ecosystem.

7. Bias, risks and limitations

Inkling 2 Small may exhibit general limitations common to foundation models, including hallucination (generating plausible but factually incorrect or unsupported content), occasional failures to follow instructions precisely, and degraded performance in long multi-turn conversations. As with other large-scale models trained on web-derived and synthetic data, Inkling 2 Small may reflect biases present in its training data, including demographic, cultural, or linguistic biases, and may perform unevenly across languages, dialects, or subject domains that were less represented during training.

Inkling 2 Small's knowledge is limited to information available as of its training cutoff, and it may not reflect events, developments, or changes that occurred afterward.

We recommend that downstream developers and deployers apply appropriate human oversight and review for outputs used in high-stakes or safety-critical contexts, rather than relying on Inkling 2 Small's outputs without verification.

Conduct their own evaluation of Inkling 2 Small's performance, safety, and fairness for their specific use case, language, and population prior to deployment, particularly for applications involving vulnerable groups.
Implement additional safeguards — such as content filtering, rate limiting, and monitoring — at the application layer, especially for open deployment contexts where Inkling 2 Small's built-in mitigations may not be sufficient on their own.
Avoid deploying Inkling 2 Small in domains such as medical, legal, or safety-critical decision-making without additional fine-tuning, domain-specific validation, and human oversight.
8. Legal

Training Data Documentation

LINKS:
https://developers.cloudflare.com/workers-ai/models/inkling-2-small/
https://discuss.huggingface.co/
https://docs.sglang.io/cookbook/autoregressive/ThinkingMachines/Inkling-2-Small
https://docs.skyrl.ai/docs/models/inkling2
https://github.com/huggingface
https://github.com/snowflakedb/cortex-training
https://github.com/thinking-machines-lab/tinker-cookbook
https://huggingface.co/
https://huggingface.co/blog
https://huggingface.co/chat
https://huggingface.co/chat/models/thinkingmachines/Inkling-2-Small
https://huggingface.co/collections
https://huggingface.co/datasets
https://huggingface.co/docs
https://huggingface.co/docs/hub/model-cards#model-card-metadata
https://huggingface.co/enterprise
https://huggingface.co/hardware
https://huggingface.co/inference-endpoints
https://huggingface.co/inference/models
https://huggingface.co/join
https://huggingface.co/join/discord
https://huggingface.co/languages
https://huggingface.co/learn
https://huggingface.co/login
https://huggingface.co/marstin-thinky
https://huggingface.co/models
https://huggingface.co/models?library=safetensors
https://huggingface.co/models?library=transformers
https://huggingface.co/models?other=8-bit
https://huggingface.co/models?other=conversational
https://huggingface.co/models?other=eval-results
https://huggingface.co/models?other=inkling2
https://huggingface.co/models?other=modelopt
https://huggingface.co/models?other=moe
https://huggingface.co/models?pipeline_tag=image-text-to-text
https://huggingface.co/organizations
https://huggingface.co/papers
https://huggingface.co/posts
https://huggingface.co/pricing
https://huggingface.co/pro
https://huggingface.co/settings/local-apps
https://huggingface.co/spaces
https://huggingface.co/storage
https://huggingface.co/support
https://huggingface.co/tasks
https://huggingface.co/thinkingmachines
https://huggingface.co/thinkingmachines/Inkling-2-Small
https://huggingface.co/thinkingmachines/Inkling-2-Small-MXFP8
https://huggingface.co/thinkingmachines/Inkling-2-Small/blame/main/README.md
https://huggingface.co/thinkingmachines/Inkling-2-Small/blob/main/README.md
https://huggingface.co/thinkingmachines/Inkling-2-Small/blob/main/README.md#1-general-information
https://huggingface.co/thinkingmachines/Inkling-2-Small/blob/main/README.md#2-getting-started
https://huggingface.co/thinkingmachines/Inkling-2-Small/blob/main/README.md#3-model-properties
https://huggingface.co/thinkingmachines/Inkling-2-Small/blob/main/README.md#4-training
https://huggingface.co/thinkingmachines/Inkling-2-Small/blob/main/README.md#5-evaluations
https://huggingface.co/thinkingmachines/Inkling-2-Small/blob/main/README.md#6-safety
https://huggingface.co/thinkingmachines/Inkling-2-Small/blob/main/README.md#7-bias-risks-and-limitations
https://huggingface.co/thinkingmachines/Inkling-2-Small/blob/main/README.md#8-legal
https://huggingface.co/thinkingmachines/Inkling-2-Small/blob/main/README.md#architecture-type
https://huggingface.co/thinkingmachines/Inkling-2-Small/blob/main/README.md#inkling-2-small
https://huggingface.co/thinkingmachines/Inkling-2-Small/blob/main/README.md#input-modalities
https://huggingface.co/thinkingmachines/Inkling-2-Small/blob/main/README.md#model-type
https://huggingface.co/thinkingmachines/Inkling-2-Small/blob/main/README.md#numerics-support
https://huggingface.co/thinkingmachines/Inkling-2-Small/blob/main/README.md#output-modalities
https://huggingface.co/thinkingmachines/Inkling-2-Small/blob/main/README.md#parameters
https://huggingface.co/thinkingmachines/Inkling-2-Small/blob/main/README.md#required-hardware
https://huggingface.co/thinkingmachines/Inkling-2-Small/blob/main/README.md#required-software
https://huggingface.co/thinkingmachines/Inkling-2-Small/blob/main/README.md?code=true
https://huggingface.co/thinkingmachines/Inkling-2-Small/colab
https://huggingface.co/thinkingmachines/Inkling-2-Small/commit/4d564489295e30e9341a9822a8046f0c9ded1a7b
https://huggingface.co/thinkingmachines/Inkling-2-Small/commits/main/README.md
https://huggingface.co/thinkingmachines/Inkling-2-Small/delete/main/README.md
https://huggingface.co/thinkingmachines/Inkling-2-Small/discussions
https://huggingface.co/thinkingmachines/Inkling-2-Small/discussions/10
https://huggingface.co/thinkingmachines/Inkling-2-Small/edit/main/README.md
https://huggingface.co/thinkingmachines/Inkling-2-Small/kaggle
https://huggingface.co/thinkingmachines/Inkling-2-Small/raw/main/README.md
https://huggingface.co/thinkingmachines/Inkling-2-Small/resolve/main/README.md?download=true
https://huggingface.co/thinkingmachines/Inkling-2-Small/tree/main
https://huggingface.co/thinkingmachines/Inkling-2-Small?library=transformers
https://huggingface.co/thinkingmachines/Inkling-2-Small?local-app=docker-model-runner
https://huggingface.co/thinkingmachines/Inkling-2-Small?local-app=sglang
https://huggingface.co/thinkingmachines/Inkling-2-Small?local-app=vllm
https://lightseek.org/tokenspeed/recipes/models#inkling-2
https://miles.radixark.com/docs/models/thinkingmachines/inkling-2-small
https://modal.com/library/thinking-machines/inkling-2-small
https://pypi.org/project/tml-renderers/
https://recipes.vllm.ai/thinkingmachines/Inkling-2-Small
https://thinkingmachines.ai/model-acceptable-use-policy
https://thinkingmachines.ai/training-data-documentation/
https://tinker.thinkingmachines.ai/playground
https://tokenfactory.nebius.com/endpoints/public/thinkingmachines%2FInkling-2-Small
https://unsloth.ai/docs/models/inkling-2
https://www.baseten.co/library/inkling-2-small
https://www.together.ai/models/inkling-2-small