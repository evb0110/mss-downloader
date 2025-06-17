const TelegramBot = require('node-telegram-bot-api');

const token = '7825780367:AAEgMIQxaG5hbDNJw9oLtylRxd7Ddr9vzBo';

async function testBot() {
    try {
        const bot = new TelegramBot(token);
        
        console.log('Testing bot connection...');
        const me = await bot.getMe();
        console.log('✅ Bot info:', me);
        
        console.log('\nTesting webhook info...');
        const webhookInfo = await bot.getWebHookInfo();
        console.log('Webhook info:', webhookInfo);
        
        console.log('\nDeleting webhook if it exists...');
        await bot.deleteWebHook();
        console.log('✅ Webhook deleted');
        
        console.log('\nStarting polling...');
        bot.startPolling();
        
        bot.onText(/\/start/, (msg) => {
            console.log('📨 Received /start from:', msg.from.username || msg.from.first_name);
            bot.sendMessage(msg.chat.id, '🤖 Test bot is working!');
        });
        
        bot.onText(/\/subscribe/, (msg) => {
            console.log('📨 Received /subscribe from:', msg.from.username || msg.from.first_name);
            bot.sendMessage(msg.chat.id, '✅ Test subscription successful!');
        });
        
        bot.on('message', (msg) => {
            console.log('📨 Message received:', {
                from: msg.from.username || msg.from.first_name,
                text: msg.text,
                chat_id: msg.chat.id
            });
        });
        
        bot.on('error', (error) => {
            console.error('❌ Bot error:', error);
        });
        
        bot.on('polling_error', (error) => {
            console.error('❌ Polling error:', error);
        });
        
        console.log('✅ Test bot started. Send /start or /subscribe to test...');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testBot();