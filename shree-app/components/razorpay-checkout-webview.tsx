import React, { useMemo } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/contexts/theme-context';

interface Props {
    visible: boolean;
    keyId: string;
    orderId: string;
    amount: number; // paise
    currency?: string;
    name: string;
    description: string;
    prefillContact?: string;
    onClose: () => void;
    onSuccess: (data: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => void;
    onFailure: (msg: string) => void;
}

export default function RazorpayCheckoutWebView({
    visible, keyId, orderId, amount, currency = 'INR', name, description, prefillContact,
    onClose, onSuccess, onFailure,
}: Props) {
    const { theme } = useAppTheme();

    const html = useMemo(() => {
        const payload = {
            key: keyId,
            order_id: orderId,
            amount,
            currency,
            name: name || 'Shree Jii',
            description: description || 'Membership',
            prefill: { contact: prefillContact || '' },
            theme: { color: '#E6A700' },
            // UPI ONLY
            method: { upi: true, card: false, netbanking: false, wallet: false, emi: false, paylater: false },
            config: {
                display: {
                    blocks: {
                        upi_block: { name: 'Pay via UPI', instruments: [{ method: 'upi' }] },
                    },
                    sequence: ['block.upi_block'],
                    preferences: { show_default_blocks: false },
                },
            },
        };
        return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>html,body{margin:0;padding:0;height:100%;background:#fff;font-family:-apple-system,Roboto,sans-serif;}
.wrap{display:flex;align-items:center;justify-content:center;height:100%;flex-direction:column;color:#666;}
.dot{width:10px;height:10px;border-radius:50%;background:#E6A700;margin:3px;display:inline-block;animation:b 1s infinite alternate;}
.dot:nth-child(2){animation-delay:.2s}.dot:nth-child(3){animation-delay:.4s}
@keyframes b{to{transform:translateY(-8px)}}
</style></head><body>
<div class="wrap"><div><span class="dot"></span><span class="dot"></span><span class="dot"></span></div><p style="margin-top:12px;font-size:13px;">Loading payment…</p></div>
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<script>
  const post = (msg) => window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(msg));
  const opts = ${JSON.stringify(payload)};
  opts.handler = function(resp){ post({ type: 'success', data: resp }); };
  opts.modal = { ondismiss: function(){ post({ type: 'dismiss' }); }, escape: true, backdropclose: false };
  try {
    const rzp = new Razorpay(opts);
    rzp.on('payment.failed', function(resp){ post({ type: 'failed', data: resp.error || {} }); });
    setTimeout(function(){ rzp.open(); }, 250);
  } catch (e) { post({ type: 'failed', data: { description: String(e) } }); }
</script></body></html>`;
    }, [keyId, orderId, amount, currency, name, description, prefillContact]);

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
            <View style={[s.container, { backgroundColor: theme.bgCream }]}>
                <View style={[s.header, { backgroundColor: theme.headerBg, borderBottomColor: theme.cardBorder }]}>
                    <TouchableOpacity onPress={onClose} hitSlop={10} style={s.backBtn}>
                        <Ionicons name="close" size={24} color={theme.headerText} />
                    </TouchableOpacity>
                    <Text style={[s.headerTitle, { color: theme.headerText }]}>Pay with UPI</Text>
                    <View style={{ width: 28 }} />
                </View>
                {visible && (
                    <WebView
                        originWhitelist={['*']}
                        source={{ html, baseUrl: 'https://checkout.razorpay.com' }}
                        javaScriptEnabled
                        domStorageEnabled
                        mixedContentMode="always"
                        startInLoadingState
                        renderLoading={() => (
                            <View style={s.loading}><ActivityIndicator size="large" color={theme.accent} /></View>
                        )}
                        onMessage={(e) => {
                            try {
                                const msg = JSON.parse(e.nativeEvent.data || '{}');
                                if (msg.type === 'success' && msg.data) onSuccess(msg.data);
                                else if (msg.type === 'failed') onFailure(msg.data?.description || 'Payment failed');
                                else if (msg.type === 'dismiss') onClose();
                            } catch { /* ignore */ }
                        }}
                        style={{ flex: 1, backgroundColor: '#fff' }}
                    />
                )}
            </View>
        </Modal>
    );
}

const s = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1,
        paddingTop: 40,
    },
    backBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 16, fontWeight: '700' },
    loading: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
});
