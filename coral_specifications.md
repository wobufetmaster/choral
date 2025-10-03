Info about this project: 
    Choral is designed to be a drop in replacement for Sillytavern. It is an application that serves as a frontend for talking to AI characters and providing a UI for LLM API's. 


Requirements:
    Choral should obey the Character card V3 spec, included in this directory. It should save it's characters as .png files with the spec embedded inside of them. A sample character, "Roxanne.png" is provided as an example, it is a valid V3 character card and should be able to be read by the software. 

    Should be able to support any backend with an OpenAI compatible URL, but openrouter should be the default. The chat should support streaming API's and display messages as they are written.


    App should work in termux on android. 

    There is a file, pixijb-v18.2.json that contains a configuration, complete with system prompt, and model selection. Choral should allow the import of these files, but it doesn't need to totally conform to that standard, you can ignore fields, simplify, and omit them. (For instance, it doesn't really make sense to have claude_model and openai_model and openrouter_model, it should really just be a field for model and a field for provider)

    The UI should be clean and concise, with commonly used settings very easy to access, and more obscure settings buried deeper. 

    On desktop, the UI should be tab based, inspired by a web browser. It should be fast and easy to switch between tabs that contain different chats, and also to reorganize them.

    It should be easy to create branches inside of chats, to explore different possibilities in scenarios. 

    Chats should be saved as json format, and you should be able to load previous chats easily.

    It should be easy to edit the responses from the AI, and to delete messages.

    Group chats with multiple characters should be supported, and the user should be allowed to choose which character should respond next, or have it be random. There should be options to either join the descriptions of all of the characters together before sending to the AI, or only send the active character. 

    Lorebooks should be supported.

    There should be a persona management feature, where the user can create personas that they can be during the RP chat. 



    It should be easy to manage a lot of different characters via some sort of tag based system. 

    It would be nice if there was an automated way to create character cards from a chat with a "character builder" character. Maybe via a tool calling functionality? 

    Inside of the chat, any written HTML should be rendered. 

    There should be UI theming support. 

    The frontend should use Vue and the backend should use expressJS.

    Use Vite for building and npm as the package manager.

    There should be a config file in the base of this directory that specifies things like what port to use. 

    A copy of the Sillytavern repo is contained in this directory in case you would like to reference it's code for any reason. 


There is an $OPENROUTER_API_KEY environment variable set, if you need to test making API calls.

What you do not need to support:
    You do not need to support windows.
    You do not need to support text completion API's, only chat completion.



Claude's questions:
    API keys should be global
    Lorebooks should follow the sillytavern format.
    For group chats, all of the message history should always be sent, it's just the specific definitions of the characters that should be swapped.
    Tree view for branching UX
    Use your best judgement for file storage, I will probably use syncthing to sync them across my phone and computer.
    Try to have one design for desktop / mobile but there will almost certainly need to be different layouts for things (tabs don't really work on mobile)
    I think the tags should be embedded in the cards.

    You can sandbox the HTML, images need to be able to render though.

    Just focus on implementing the card V3 spec and the prompt format json, that's really all I'm concerned with.

    For tool calling, as long as it works for anthropic I'm happy, I don't care about any of the other ones.

    Don't need image / vision API or multi-user stuff. 

Oh also, you should be able to install this as a PWA. 




Prompt Post-Processing

Some endpoints may impose specific restrictions on the format of incoming prompts, such as requiring only one system message or strictly alternating roles.

SillyTavern provides built-in prompt converters to help meet these requirements (from least to most restrictive):

    None - no explicit processing applied unless strictly required by the API
    Merge consecutive messages from the same role
    Semi-strict - merge roles and allow only one optional system message
    Strict - merge roles, allow only one optional system message, and require a user message to be first
    Single user message - merge all messages from all roles into a single user message

Merge, semi-strict, and strict additionally remove any tool calls from the prompt, unless the "with tools" variant is selected. This is useful for APIs that do not support tool calling and your existing prompts contain tool calls.

Less restrictive options have no effect on more restrictive endpoints implemented in SillyTavern other than "Custom OpenAI-compatible"; Custom may error upon invalid request.

In strict mode, if no user message exists before the first assistant message, then promptPlaceholder from config.yaml will be inserted, which by default is "[Start a new chat]".

