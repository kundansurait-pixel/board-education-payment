// ═══════════════════════════════════════════
// BOARD EDUCATION NILESH — Razorpay Backend
// Deploy on: Render.com / Railway.app (FREE)
// ═══════════════════════════════════════════

const express  = require('express');
const axios    = require('axios');
const cors     = require('cors');
const crypto   = require('crypto');

const app = express();
app.use(cors()); // Allow all origins
app.use(express.json());

// ── Razorpay Keys ──
const RZP_KEY_ID     = 'rzp_live_SzwxtcV5yqwtyj';
const RZP_KEY_SECRET = '1Hs6MFT9TR5SE6J31qpcMX56';
const AUTH           = Buffer.from(`${RZP_KEY_ID}:${RZP_KEY_SECRET}`).toString('base64');

// ══ 1. Generate QR Code ══
app.post('/create-qr', async (req, res) => {
  const { amount, courseName, courseId } = req.body;
  try {
    const response = await axios.post(
      'https://api.razorpay.com/v1/payments/qr_codes',
      {
        type:           'upi_qr',
        name:           'BOARD EDUCATION NILESH',
        usage:          'single_use',
        fixed_amount:   true,
        payment_amount: amount * 100, // paise
        description:    courseName,
        close_by:       Math.floor(Date.now()/1000) + (30 * 60), // 30 min
      },
      { headers: { 'Authorization': `Basic ${AUTH}`, 'Content-Type': 'application/json' } }
    );
    res.json({ success: true, qr: response.data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.response?.data || err.message });
  }
});

// ══ 2. Check QR Payment Status ══
app.get('/check-qr/:qrId', async (req, res) => {
  try {
    const response = await axios.get(
      `https://api.razorpay.com/v1/payments/qr_codes/${req.params.qrId}/payments`,
      { headers: { 'Authorization': `Basic ${AUTH}` } }
    );
    const payments = response.data.items || [];
    const paid = payments.find(p => p.status === 'captured' || p.status === 'authorized');
    res.json({ success: true, paid: !!paid, payment: paid || null });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ══ 3. Razorpay Webhook (Auto detect payment) ══
app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const signature  = req.headers['x-razorpay-signature'];
  const body       = req.body;
  const expectedSig = crypto
    .createHmac('sha256', RZP_KEY_SECRET)
    .update(body)
    .digest('hex');

  if (signature !== expectedSig) {
    return res.status(400).json({ error: 'Invalid signature' });
  }

  const event = JSON.parse(body);
  console.log('Webhook event:', event.event);

  if (event.event === 'payment.captured' || event.event === 'qr_code.credited') {
    const payment = event.payload?.payment?.entity || event.payload?.qr_code?.entity;
    console.log('Payment received:', payment?.id, payment?.amount);
    // Firebase mein save karna app side se hoga via polling
  }

  res.json({ status: 'ok' });
});

// ══ 4. Verify Payment by ID ══
app.get('/verify/:paymentId', async (req, res) => {
  try {
    const response = await axios.get(
      `https://api.razorpay.com/v1/payments/${req.params.paymentId}`,
      { headers: { 'Authorization': `Basic ${AUTH}` } }
    );
    const p = response.data;
    res.json({
      success:   true,
      status:    p.status,
      amount:    p.amount / 100,
      paymentId: p.id,
      captured:  p.status === 'captured' || p.status === 'authorized',
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ══ Health check ══
app.get('/', (req, res) => res.json({ status: 'ok', app: 'Board Education Nilesh Payment Server' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
