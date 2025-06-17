const fs = require('fs');
const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require('discord.js');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const ADMIN_ROLE_ID = process.env.ADMIN_ROLE_ID;

const commissionFile = 'commission.json';
const volumeFile = 'volume.json';
const dailyUserFile = 'daily_commission.json';
const historyFile = 'history.json';

// Init files if missing
if (!fs.existsSync(commissionFile)) fs.writeFileSync(commissionFile, JSON.stringify({ total: 0 }));
if (!fs.existsSync(volumeFile)) fs.writeFileSync(volumeFile, JSON.stringify({ total: 0, users: {} }));
if (!fs.existsSync(dailyUserFile)) fs.writeFileSync(dailyUserFile, JSON.stringify({ users: {} }));
if (!fs.existsSync(historyFile)) fs.writeFileSync(historyFile, JSON.stringify({}));

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const commands = [
  new SlashCommandBuilder().setName('ap').setDescription('Add profit')
    .addNumberOption(opt => opt.setName('amount').setDescription('Amount to add').setRequired(true))
    .addUserOption(opt => opt.setName('user').setDescription('User to apply profit to (optional)')),
  new SlashCommandBuilder().setName('rp').setDescription('Remove profit')
    .addNumberOption(opt => opt.setName('amount').setDescription('Amount to remove').setRequired(true))
    .addUserOption(opt => opt.setName('user').setDescription('User to remove profit from (optional)')),
  new SlashCommandBuilder().setName('vol').setDescription('Show volume earned')
    .addUserOption(opt => opt.setName('user').setDescription('User to check (optional)'))
    .addStringOption(opt => opt.setName('date').setDescription('Date (YYYY-MM-DD) to check (optional)')),
  new SlashCommandBuilder().setName('dm').setDescription('Show today\'s profit')
    .addUserOption(opt => opt.setName('user').setDescription('User to check (optional)')),
  new SlashCommandBuilder().setName('cp').setDescription('Calculate Cody pay')
    .addUserOption(opt => opt.setName('user').setDescription('User to check').setRequired(true))
    .addIntegerOption(opt => opt.setName('rate').setDescription('Rate percentage (10 or 15)').setRequired(true)
      .addChoices({ name: '10%', value: 10 }, { name: '15%', value: 15 })),
  new SlashCommandBuilder().setName('reset').setDescription('Reset your profit to 0'),
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    console.log('Registering slash commands...');
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log('Commands registered.');
  } catch (error) {
    console.error(error);
  }
})();

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  const { commandName, user, member } = interaction;
  if (!member.roles.cache.has(ADMIN_ROLE_ID)) {
    await interaction.reply({ content: 'No permission.', ephemeral: true });
    return;
  }

  const today = new Date().toISOString().split('T')[0];
  const historyData = JSON.parse(fs.readFileSync(historyFile));

  if (commandName === 'ap' || commandName === 'rp') {
    const amount = interaction.options.getNumber('amount');
    const targetUser = interaction.options.getUser('user') || user;
    const delta = commandName === 'ap' ? amount : -amount;

    const commissionData = JSON.parse(fs.readFileSync(commissionFile));
    commissionData.total = Math.max(0, commissionData.total + delta);
    fs.writeFileSync(commissionFile, JSON.stringify(commissionData));

    const volumeData = JSON.parse(fs.readFileSync(volumeFile));
    if (!volumeData.users[targetUser.id]) volumeData.users[targetUser.id] = 0;
    volumeData.users[targetUser.id] = Math.max(0, volumeData.users[targetUser.id] + delta);
    volumeData.total = Math.max(0, volumeData.total + delta);
    fs.writeFileSync(volumeFile, JSON.stringify(volumeData));

    const dailyUserData = JSON.parse(fs.readFileSync(dailyUserFile));
    if (!dailyUserData.users[targetUser.id]) dailyUserData.users[targetUser.id] = 0;
    dailyUserData.users[targetUser.id] = Math.max(0, dailyUserData.users[targetUser.id] + delta);
    fs.writeFileSync(dailyUserFile, JSON.stringify(dailyUserData));

    if (!historyData[today]) historyData[today] = { total: 0, users: {} };
    if (!historyData[today].users[targetUser.id]) historyData[today].users[targetUser.id] = 0;
    historyData[today].users[targetUser.id] = Math.max(0, historyData[today].users[targetUser.id] + delta);
    historyData[today].total = Math.max(0, historyData[today].total + delta);
    fs.writeFileSync(historyFile, JSON.stringify(historyData));

    await interaction.reply({
      content: `${commandName === 'ap' ? 'Added' : 'Removed'} $${Math.abs(amount).toFixed(2)} ${commandName === 'ap' ? 'to' : 'from'} ${targetUser.username}'s profit.`,
      ephemeral: true
    });
  }

  if (commandName === 'vol') {
    const volumeData = JSON.parse(fs.readFileSync(volumeFile));
    const targetUser = interaction.options.getUser('user');
    const dateOption = interaction.options.getString('date');

    if (dateOption) {
      const dateEntry = historyData[dateOption];
      if (!dateEntry) {
        await interaction.reply({ content: `No data for ${dateOption}.`, ephemeral: true });
        return;
      }

      if (targetUser) {
        const userTotal = dateEntry.users[targetUser.id] || 0;
        await interaction.reply({ content: `${targetUser.username} earned $${userTotal.toFixed(2)} on ${dateOption}.`, ephemeral: true });
      } else {
        await interaction.reply({ content: `Server earned $${dateEntry.total.toFixed(2)} on ${dateOption}.`, ephemeral: true });
      }
    } else {
      if (targetUser) {
        const userTotal = volumeData.users[targetUser.id] || 0;
        await interaction.reply({ content: `${targetUser.username} has earned $${userTotal.toFixed(2)} total.`, ephemeral: true });
      } else {
        await interaction.reply({ content: `Server total volume: $${volumeData.total.toFixed(2)}`, ephemeral: true });
      }
    }
  }

  if (commandName === 'dm') {
    const commissionData = JSON.parse(fs.readFileSync(commissionFile));
    const dailyUserData = JSON.parse(fs.readFileSync(dailyUserFile));
    const targetUser = interaction.options.getUser('user');

    if (targetUser) {
      const userDaily = dailyUserData.users[targetUser.id] || 0;
      await interaction.reply({ content: `${targetUser.username} made $${userDaily.toFixed(2)} today.`, ephemeral: true });
    } else {
      await interaction.reply({ content: `Server made $${commissionData.total.toFixed(2)} today.`, ephemeral: true });
    }
  }

  if (commandName === 'cp') {
    const targetUser = interaction.options.getUser('user');
    const rate = interaction.options.getInteger('rate');

    const dailyUserData = JSON.parse(fs.readFileSync(dailyUserFile));
    const userDaily = dailyUserData.users[targetUser.id] || 0;
    const payAmount = userDaily * (rate / 100);

    await interaction.reply({ content: `${targetUser.username} owes Cody $${payAmount.toFixed(2)} (${rate}% of $${userDaily.toFixed(2)} today).`, ephemeral: true });
  }

  if (commandName === 'reset') {
    const volumeData = JSON.parse(fs.readFileSync(volumeFile));
    const dailyUserData = JSON.parse(fs.readFileSync(dailyUserFile));

    const userTotalBefore = volumeData.users[user.id] || 0;
    volumeData.total = Math.max(0, volumeData.total - userTotalBefore);
    volumeData.users[user.id] = 0;
    fs.writeFileSync(volumeFile, JSON.stringify(volumeData));

    dailyUserData.users[user.id] = 0;
    fs.writeFileSync(dailyUserFile, JSON.stringify(dailyUserData));

    await interaction.reply({ content: `Your profit has been reset to $0.`, ephemeral: true });
  }
});

client.login(TOKEN);
