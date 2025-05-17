const fs = require('fs');
const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require('discord.js');
const schedule = require('node-schedule');

const TOKEN = '';
const CLIENT_ID = '';
const GUILD_ID = '';
const ADMIN_ROLE_ID = '';

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
    .addNumberOption(opt => opt.setName('amount').setDescription('Amount to add').setRequired(true)),
  new SlashCommandBuilder().setName('rp').setDescription('Remove profit')
    .addNumberOption(opt => opt.setName('amount').setDescription('Amount to remove').setRequired(true)),
  new SlashCommandBuilder().setName('vol').setDescription('Show volume earned')
    .addUserOption(opt => opt.setName('user').setDescription('User to check (optional)'))
    .addStringOption(opt => opt.setName('date').setDescription('Date (YYYY-MM-DD) to check (optional)')),
  new SlashCommandBuilder().setName('dm').setDescription('Show today\'s profit')
    .addUserOption(opt => opt.setName('user').setDescription('User to check (optional)')),
  new SlashCommandBuilder().setName('cp').setDescription('Calculate Cody pay')
    .addUserOption(opt => opt.setName('user').setDescription('User to check').setRequired(true))
    .addIntegerOption(opt => opt.setName('rate').setDescription('Rate percentage (10 or 15)').setRequired(true)
      .addChoices({ name: '10%', value: 10 }, { name: '15%', value: 15 })),
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

// Daily reset
schedule.scheduleJob({ hour: 0, minute: 0, tz: 'America/New_York' }, () => {
  console.log('Resetting daily profits...');
  fs.writeFileSync(commissionFile, JSON.stringify({ total: 0 }));
  fs.writeFileSync(dailyUserFile, JSON.stringify({ users: {} }));
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
    const delta = commandName === 'ap' ? amount : -amount;

    // Update global daily commission
    const commissionData = JSON.parse(fs.readFileSync(commissionFile));
    commissionData.total = Math.max(0, commissionData.total + delta);
    fs.writeFileSync(commissionFile, JSON.stringify(commissionData));

    // Update global volume & user volume
    const volumeData = JSON.parse(fs.readFileSync(volumeFile));
    if (!volumeData.users[user.id]) volumeData.users[user.id] = 0;
    volumeData.users[user.id] = Math.max(0, volumeData.users[user.id] + delta);
    volumeData.total = Math.max(0, volumeData.total + delta);
    fs.writeFileSync(volumeFile, JSON.stringify(volumeData));

    // Update daily user profit
    const dailyUserData = JSON.parse(fs.readFileSync(dailyUserFile));
    if (!dailyUserData.users[user.id]) dailyUserData.users[user.id] = 0;
    dailyUserData.users[user.id] = Math.max(0, dailyUserData.users[user.id] + delta);
    fs.writeFileSync(dailyUserFile, JSON.stringify(dailyUserData));

    // Update history
    if (!historyData[today]) historyData[today] = { total: 0, users: {} };
    if (!historyData[today].users[user.id]) historyData[today].users[user.id] = 0;
    historyData[today].users[user.id] = Math.max(0, historyData[today].users[user.id] + delta);
    historyData[today].total = Math.max(0, historyData[today].total + delta);
    fs.writeFileSync(historyFile, JSON.stringify(historyData));

    await interaction.reply(`${commandName === 'ap' ? 'Added' : 'Removed'} $${Math.abs(amount).toFixed(2)} ${commandName === 'ap' ? 'to' : 'from'} your profit.`);
  }

  if (commandName === 'vol') {
    const volumeData = JSON.parse(fs.readFileSync(volumeFile));
    const targetUser = interaction.options.getUser('user');
    const dateOption = interaction.options.getString('date');

    if (dateOption) {
      const dateEntry = historyData[dateOption];
      if (!dateEntry) {
        await interaction.reply(`No data for ${dateOption}.`);
        return;
      }

      if (targetUser) {
        const userTotal = dateEntry.users[targetUser.id] || 0;
        await interaction.reply(`${targetUser.username} earned $${userTotal.toFixed(2)} on ${dateOption}.`);
      } else {
        await interaction.reply(`Server earned $${dateEntry.total.toFixed(2)} on ${dateOption}.`);
      }
    } else {
      if (targetUser) {
        const userTotal = volumeData.users[targetUser.id] || 0;
        await interaction.reply(`${targetUser.username} has earned $${userTotal.toFixed(2)} total.`);
      } else {
        await interaction.reply(`Server total volume: $${volumeData.total.toFixed(2)}`);
      }
    }
  }

  if (commandName === 'dm') {
    const commissionData = JSON.parse(fs.readFileSync(commissionFile));
    const dailyUserData = JSON.parse(fs.readFileSync(dailyUserFile));
    const targetUser = interaction.options.getUser('user');

    if (targetUser) {
      const userDaily = dailyUserData.users[targetUser.id] || 0;
      await interaction.reply(`${targetUser.username} made $${userDaily.toFixed(2)} today.`);
    } else {
      await interaction.reply(`Server made $${commissionData.total.toFixed(2)} today.`);
    }
  }

  if (commandName === 'cp') {
    const targetUser = interaction.options.getUser('user');
    const rate = interaction.options.getInteger('rate');

    const dailyUserData = JSON.parse(fs.readFileSync(dailyUserFile));
    const userDaily = dailyUserData.users[targetUser.id] || 0;
    const payAmount = userDaily * (rate / 100);

    await interaction.reply(`${targetUser.username} owes Cody $${payAmount.toFixed(2)} (${rate}% of $${userDaily.toFixed(2)} today).`);
  }
});

client.login(TOKEN);
