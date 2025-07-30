const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require('discord.js');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

// Removed file-related imports and initializations as they are no longer needed.
// Removed GUILD_ID and ADMIN_ROLE_ID as they are no longer relevant for a single public global command.

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.MessageContent] });

const commands = [
    // Only the /nepal command definition remains
    new SlashCommandBuilder()
        .setName('nepal')
        .setDescription('Sends your message to the channel.')
        .addStringOption(option =>
            option.setName('message')
                .setDescription('The message to send.')
                .setRequired(true)
        ),
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    try {
        console.log('Registering slash commands globally...');
        // Registers commands globally
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('Global commands registered.');
    } catch (error) {
        console.error(error);
    }
})();

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName } = interaction; // user and member are no longer needed

    // No admin role check needed as /nepal is public and the only command.

    // Only the /nepal command handler remains
    if (commandName === 'nepal') {
        const message = interaction.options.getString('message');
        await interaction.reply({ content: 'Sending your Nepal message...', ephemeral: true });
        await interaction.channel.send(message);
    }
});

client.login(TOKEN);
