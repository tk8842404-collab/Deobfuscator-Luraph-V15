const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  AttachmentBuilder
} = require("discord.js");

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

if (!TOKEN || !CLIENT_ID) {
  throw new Error("Missing DISCORD_TOKEN or CLIENT_ID environment variable.");
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const command = new SlashCommandBuilder()
  .setName("deobfuscate")
  .setDescription("Analyze a Lua file you are authorized to inspect.")
  .addAttachmentOption(option =>
    option
      .setName("file")
      .setDescription("The Lua file to analyze")
      .setRequired(true)
  );

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "deobfuscate") return;

  await interaction.deferReply();

  let directory;

  try {
    const attachment = interaction.options.getAttachment("file");

    if (!attachment.name.toLowerCase().endsWith(".lua")) {
      return interaction.editReply("Please upload a `.lua` file.");
    }

    if (attachment.size > 5 * 1024 * 1024) {
      return interaction.editReply("The file must be 5 MB or smaller.");
    }

    directory = fs.mkdtempSync(
      path.join(os.tmpdir(), "lua-deob-")
    );

    const input = path.join(directory, "input.lua");
    const output = path.join(directory, "output.lua");

    const response = await fetch(attachment.url);

    if (!response.ok) {
      throw new Error("Could not download the attachment.");
    }

    fs.writeFileSync(
      input,
      Buffer.from(await response.arrayBuffer())
    );

    await new Promise((resolve, reject) => {
      const process = spawn(
        "node",
        [
          path.join(__dirname, "deob.js"),
          input,
          "-o",
          output
        ],
        {
          cwd: __dirname,
          stdio: ["ignore", "pipe", "pipe"]
        }
      );

      let errors = "";
      let finished = false;

      const timer = setTimeout(() => {
        process.kill("SIGKILL");
        reject(new Error("Analysis timed out after 60 seconds."));
      }, 60000);

      process.stderr.on("data", data => {
        errors += data.toString().slice(0, 10000);
      });

      process.on("error", error => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        reject(error);
      });

      process.on("close", code => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);

        if (code !== 0) {
          reject(new Error(errors || `Process exited with code ${code}`));
        } else {
          resolve();
        }
      });
    });

    if (!fs.existsSync(output)) {
      throw new Error("The tool did not produce an output file.");
    }

    const result = new AttachmentBuilder(output, {
      name: "deobfuscated.lua"
    });

    await interaction.editReply({
      content: "Analysis finished:",
      files: [result]
    });

  } catch (error) {
    console.error(error);

    await interaction.editReply(
      "Analysis failed. Check the Railway logs for details."
    ).catch(() => {});
  } finally {
    if (directory) {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }
});

async function start() {
  const rest = new REST({ version: "10" }).setToken(TOKEN);

  await rest.put(
    Routes.applicationCommands(CLIENT_ID),
    { body: [command.toJSON()] }
  );

  await client.login(TOKEN);
}

start().catch(error => {
  console.error("Startup failed:", error);
  process.exit(1);
});
