import os

FILE_PATH = r"c:\Users\mummi\Downloads\Desktop\Flash Resume Main 6\Flashresume\src\components\ModelSelector.tsx"

with open(FILE_PATH, "r") as f:
    content = f.read()

new_models = """export const MODELS = {
  r1_preferred_model: "deepseek-v4-flash",
  options: [
    { id: "deepseek-v4-flash", name: "DeepSeek V4 Flash (Premium)" },
    
    // -- Mistral --
    { id: "mistral-large-latest|key1", name: "Mistral Large (Mistral) - Key 1" },
    { id: "mistral-large-latest|key2", name: "Mistral Large (Mistral) - Key 2" },
    { id: "mistral-medium-latest|key1", name: "Mistral Medium (Mistral) - Key 1" },
    { id: "mistral-medium-latest|key2", name: "Mistral Medium (Mistral) - Key 2" },
    { id: "mistral-medium-3.5|key1", name: "Mistral Medium 3.5 (Mistral) - Key 1" },
    { id: "mistral-medium-3.5|key2", name: "Mistral Medium 3.5 (Mistral) - Key 2" },
    { id: "mistral-medium-2604|key1", name: "Mistral Medium 2604 (Mistral) - Key 1" },
    { id: "mistral-medium-2604|key2", name: "Mistral Medium 2604 (Mistral) - Key 2" },
    { id: "ministral-14b-latest|key1", name: "Ministral 14B (Mistral) - Key 1" },
    { id: "ministral-14b-latest|key2", name: "Ministral 14B (Mistral) - Key 2" },
    { id: "mistral-small-latest|key1", name: "Mistral Small (Mistral) - Key 1" },
    { id: "mistral-small-latest|key2", name: "Mistral Small (Mistral) - Key 2" },
    
    // -- Groq --
    { id: "llama-3.3-70b-versatile|key1", name: "Llama 3.3 70B (Groq) - Key 1" },
    { id: "llama-3.3-70b-versatile|key2", name: "Llama 3.3 70B (Groq) - Key 2" },

    // -- Cloudflare --
    { id: "@cf/meta/llama-3.3-70b-instruct-fp8-fast|key1", name: "Llama 3.3 70B Fast (Cloudflare) - Key 1" },
    { id: "@cf/meta/llama-3.3-70b-instruct-fp8-fast|key2", name: "Llama 3.3 70B Fast (Cloudflare) - Key 2" },
    { id: "@cf/mistralai/mistral-small-3.1-24b-instruct|key1", name: "Mistral Small 24B (Cloudflare) - Key 1" },
    { id: "@cf/mistralai/mistral-small-3.1-24b-instruct|key2", name: "Mistral Small 24B (Cloudflare) - Key 2" },

    // -- NVIDIA --
    { id: "meta/llama-4-maverick-17b-128e-instruct|key1", name: "Llama 4 Maverick 17B (NVIDIA) - Key 1" },
    { id: "meta/llama-4-maverick-17b-128e-instruct|key2", name: "Llama 4 Maverick 17B (NVIDIA) - Key 2" },
    { id: "mistralai/mistral-medium-3.5-128b|key1", name: "Mistral Medium 3.5 128B (NVIDIA) - Key 1" },
    { id: "mistralai/mistral-medium-3.5-128b|key2", name: "Mistral Medium 3.5 128B (NVIDIA) - Key 2" },
    { id: "mistralai/mistral-nemotron|key1", name: "Mistral Nemotron (NVIDIA) - Key 1" },
    { id: "mistralai/mistral-nemotron|key2", name: "Mistral Nemotron (NVIDIA) - Key 2" },
    { id: "mistralai/ministral-14b-instruct-2512|key1", name: "Ministral 14B 2512 (NVIDIA) - Key 1" },
    { id: "mistralai/ministral-14b-instruct-2512|key2", name: "Ministral 14B 2512 (NVIDIA) - Key 2" }
  ]
};"""

start_idx = content.find("export const MODELS = {")
end_idx = content.find("};\nMODELS.preferred_model")

if start_idx != -1 and end_idx != -1:
    end_idx += 2 # include "};"
    new_content = content[:start_idx] + new_models + "\n" + content[end_idx:]
    with open(FILE_PATH, "w") as f:
        f.write(new_content)
    print("SUCCESS")
else:
    print("ERROR")
