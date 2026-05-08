import { useAuth } from '@/contexts/auth-context';
import { useLanguage } from '@/contexts/language-context';
import { useAppTheme } from '@/contexts/theme-context';
import {
    fetchWallet,
    requestWithdrawal,
    fetchUserWithdrawals,
    type WalletInfo,
    type WalletTxn,
    type WithdrawalEntry,
} from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BottomSheetMessage from '@/components/ui/bottom-sheet-message';

type ListItem =
    | { kind: 'balance' }
    | { kind: 'withdraw_form' }
    | { kind: 'section_header'; title: string }
    | { kind: 'txn'; txn: WalletTxn }
    | { kind: 'withdrawal'; entry: WithdrawalEntry }
    | { kind: 'empty'; msg: string };

export default function WalletScreen() {
    const { theme } = useAppTheme();
    const { language } = useLanguage();
    const { user } = useAuth();
    const router = useRouter();
    const isDark = theme.id === 'dark';
    const isHindi = language === 'hi';

    const textPrimary = isDark ? '#F5F5F5' : '#1A1A1A';
    const textMuted = isDark ? '#9A9A9A' : '#777777';
    const cardBg = isDark ? '#181818' : '#FFFFFF';
    const screenBg = isDark ? '#0A0A0A' : theme.bgCream;
    const inputBg = isDark ? '#1E1E1E' : '#F5F5F5';
    const inputBorder = isDark ? '#333' : '#DDD';
    const ACCENT = theme.accent;

    const [wallet, setWallet] = useState<WalletInfo | null>(null);
    const [transactions, setTransactions] = useState<WalletTxn[]>([]);
    const [withdrawals, setWithdrawals] = useState<WithdrawalEntry[]>([]);
    const [isMember, setIsMember] = useState(false);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [upiId, setUpiId] = useState('');
    const [amount, setAmount] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [sheetVisible, setSheetVisible] = useState(false);
    const [sheet, setSheet] = useState({ type: 'info' as 'success' | 'error' | 'info', title: '', message: '' });
    const showSheet = (type: 'success' | 'error' | 'info', title: string, message: string) => {
        setSheet({ type, title, message });
        setSheetVisible(true);
    };

    const load = useCallback(async () => {
        if (!user?.deviceId) return;
        try {
            const [walletData, wdList] = await Promise.all([
                fetchWallet(user.deviceId),
                fetchUserWithdrawals(user.deviceId),
            ]);
            if (walletData) {
                setWallet(walletData.wallet);
                setTransactions(walletData.transactions);
                setIsMember(walletData.isMember);
            }
            setWithdrawals(wdList);
        } catch { }
        setLoading(false);
    }, [user?.deviceId]);

    useFocusEffect(
        useCallback(() => {
            load();
        }, [load])
    );

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    }, [load]);

    const handleWithdraw = useCallback(async () => {
        if (!user?.deviceId) return;
        const amt = parseFloat(amount);
        if (!amt || amt <= 0) {
            showSheet('error', isHindi ? 'त्रुटि' : 'Error', isHindi ? 'सही राशि दर्ज करें' : 'Enter a valid amount');
            return;
        }
        if (!upiId.trim() || !upiId.includes('@')) {
            showSheet('error', isHindi ? 'त्रुटि' : 'Error', isHindi ? 'सही UPI ID दर्ज करें' : 'Enter a valid UPI ID');
            return;
        }
        if (wallet && amt > wallet.balance) {
            showSheet('error', isHindi ? 'त्रुटि' : 'Error', isHindi ? 'अपर्याप्त शेष' : 'Insufficient balance');
            return;
        }

        setSubmitting(true);
        try {
            const res = await requestWithdrawal(user.deviceId, amt, upiId.trim());
            if (res.ok) {
                showSheet(
                    'success',
                    isHindi ? 'सफल' : 'Success',
                    isHindi ? 'निकासी अनुरोध भेजा गया' : 'Withdrawal request submitted',
                );
                setAmount('');
                setUpiId('');
                await load();
            } else {
                showSheet('error', isHindi ? 'त्रुटि' : 'Error', res.message || (isHindi ? 'कुछ गलत हुआ' : 'Something went wrong'));
            }
        } catch {
            showSheet('error', isHindi ? 'त्रुटि' : 'Error', isHindi ? 'नेटवर्क त्रुटि' : 'Network error');
        }
        setSubmitting(false);
    }, [user?.deviceId, amount, upiId, wallet, isHindi, load]);

    const formatDate = (d: string) => {
        const date = new Date(d);
        return date.toLocaleDateString(isHindi ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const statusColors: Record<string, string> = {
        pending: '#F59E0B',
        approved: '#3B82F6',
        paid: '#22C55E',
        rejected: '#EF4444',
    };

    const statusLabels: Record<string, { hi: string; en: string }> = {
        pending: { hi: 'लंबित', en: 'Pending' },
        approved: { hi: 'स्वीकृत', en: 'Approved' },
        paid: { hi: 'भुगतान किया', en: 'Paid' },
        rejected: { hi: 'अस्वीकृत', en: 'Rejected' },
    };

    // Build flat list
    const listData: ListItem[] = [];
    listData.push({ kind: 'balance' });
    if (isMember && wallet && wallet.balance > 0) {
        listData.push({ kind: 'withdraw_form' });
    }
    listData.push({ kind: 'section_header', title: isHindi ? 'निकासी इतिहास' : 'Withdrawal History' });
    if (withdrawals.length === 0) {
        listData.push({ kind: 'empty', msg: isHindi ? 'कोई निकासी नहीं' : 'No withdrawals yet' });
    } else {
        withdrawals.forEach(e => listData.push({ kind: 'withdrawal', entry: e }));
    }
    listData.push({ kind: 'section_header', title: isHindi ? 'लेन-देन इतिहास' : 'Transaction History' });
    if (transactions.length === 0) {
        listData.push({ kind: 'empty', msg: isHindi ? 'कोई लेन-देन नहीं' : 'No transactions yet' });
    } else {
        transactions.forEach(tx => listData.push({ kind: 'txn', txn: tx }));
    }

    const renderItem = ({ item }: { item: ListItem }) => {
        if (item.kind === 'balance') {
            return (
                <LinearGradient
                    colors={(isDark ? ['#1A3A1A', '#0A2A0A'] : ['#E8F5E9', '#C8E6C9']) as readonly [string, string]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.balanceCard, { borderColor: '#4CAF5055' }]}
                >
                    <Ionicons name="wallet-outline" size={32} color="#4CAF50" />
                    <View style={{ marginLeft: 14, flex: 1 }}>
                        <Text style={[styles.balanceLabel, { color: textMuted }]}>
                            {isHindi ? 'वॉलेट शेष' : 'Wallet Balance'}
                        </Text>
                        <Text style={[styles.balanceAmount, { color: '#4CAF50' }]}>
                            ₹{wallet?.balance?.toFixed(2) || '0.00'}
                        </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.statLabel, { color: textMuted }]}>{isHindi ? 'कुल कमाई' : 'Total Earned'}</Text>
                        <Text style={[styles.statValue, { color: textPrimary }]}>₹{wallet?.totalEarned?.toFixed(2) || '0.00'}</Text>
                        <Text style={[styles.statLabel, { color: textMuted, marginTop: 4 }]}>{isHindi ? 'कुल निकासी' : 'Withdrawn'}</Text>
                        <Text style={[styles.statValue, { color: textPrimary }]}>₹{wallet?.totalWithdrawn?.toFixed(2) || '0.00'}</Text>
                    </View>
                </LinearGradient>
            );
        }

        if (item.kind === 'withdraw_form') {
            return (
                <View style={[styles.formCard, { backgroundColor: cardBg, borderColor: isDark ? '#222' : '#E5E5E5' }]}>
                    <Text style={[styles.formTitle, { color: textPrimary }]}>
                        {isHindi ? 'UPI से निकासी करें' : 'Withdraw to UPI'}
                    </Text>
                    <TextInput
                        style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: textPrimary }]}
                        placeholder={isHindi ? 'UPI ID (जैसे name@upi)' : 'UPI ID (e.g. name@upi)'}
                        placeholderTextColor={textMuted}
                        value={upiId}
                        onChangeText={setUpiId}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        maxLength={100}
                    />
                    <TextInput
                        style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: textPrimary }]}
                        placeholder={isHindi ? 'राशि (₹)' : 'Amount (₹)'}
                        placeholderTextColor={textMuted}
                        value={amount}
                        onChangeText={setAmount}
                        keyboardType="numeric"
                        maxLength={10}
                    />
                    <TouchableOpacity
                        style={[styles.withdrawBtn, { backgroundColor: ACCENT }]}
                        onPress={handleWithdraw}
                        disabled={submitting}
                        activeOpacity={0.7}
                    >
                        {submitting ? (
                            <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                            <Text style={styles.withdrawBtnText}>
                                {isHindi ? 'निकासी अनुरोध भेजें' : 'Submit Withdrawal'}
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            );
        }

        if (item.kind === 'section_header') {
            return (
                <Text style={[styles.sectionHeader, { color: ACCENT }]}>
                    {item.title}
                </Text>
            );
        }

        if (item.kind === 'empty') {
            return (
                <View style={[styles.emptyCard, { backgroundColor: cardBg, borderColor: isDark ? '#222' : '#E5E5E5' }]}>
                    <Text style={{ color: textMuted, fontSize: 13 }}>{item.msg}</Text>
                </View>
            );
        }

        if (item.kind === 'withdrawal') {
            const e = item.entry;
            const stColor = statusColors[e.status] || textMuted;
            return (
                <View style={[styles.txnCard, { backgroundColor: cardBg, borderColor: isDark ? '#222' : '#E5E5E5' }]}>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.txnTitle, { color: textPrimary }]}>₹{e.amount}</Text>
                        <Text style={[styles.txnSub, { color: textMuted }]}>{e.upiId}</Text>
                        <Text style={[styles.txnDate, { color: textMuted }]}>{formatDate(e.createdAt)}</Text>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: stColor + '22', borderColor: stColor }]}>
                        <Text style={[styles.statusText, { color: stColor }]}>
                            {isHindi ? statusLabels[e.status]?.hi : statusLabels[e.status]?.en}
                        </Text>
                    </View>
                </View>
            );
        }

        // txn
        const tx = item.txn;
        const isCredit = tx.type === 'credit_reward' || tx.type === 'debit_withdrawal_reverted';
        return (
            <View style={[styles.txnCard, { backgroundColor: cardBg, borderColor: isDark ? '#222' : '#E5E5E5' }]}>
                <Ionicons
                    name={isCredit ? 'arrow-down-circle' : 'arrow-up-circle'}
                    size={28}
                    color={isCredit ? '#4CAF50' : '#EF4444'}
                />
                <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[styles.txnTitle, { color: textPrimary }]}>
                        {isCredit ? '+' : '-'}₹{tx.amount}
                    </Text>
                    <Text style={[styles.txnSub, { color: textMuted }]} numberOfLines={1}>
                        {tx.rewardTitle || tx.note || (isCredit ? (isHindi ? 'पुरस्कार' : 'Reward') : (isHindi ? 'निकासी' : 'Withdrawal'))}
                    </Text>
                </View>
                <Text style={[styles.txnDate, { color: textMuted }]}>{formatDate(tx.createdAt)}</Text>
            </View>
        );
    };

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: screenBg, justifyContent: 'center', alignItems: 'center' }]} edges={['top']}>
                <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={screenBg} translucent={false} />
                <ActivityIndicator size="large" color={ACCENT} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: screenBg }]} edges={['top']}>
            <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={screenBg} translucent={false} />

            {/* Header */}
            <View style={styles.headerWrap}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={textPrimary} />
                </TouchableOpacity>
                <Ionicons name="wallet" size={22} color={ACCENT} style={{ marginRight: 8 }} />
                <Text style={[styles.headerTitle, { color: textPrimary }]}>
                    {isHindi ? 'मेरा वॉलेट' : 'My Wallet'}
                </Text>
            </View>

            {!isMember && (
                <TouchableOpacity
                    style={[styles.memberCta, { backgroundColor: '#7C3AED22', borderColor: '#7C3AED' }]}
                    onPress={() => router.push('/membership')}
                    activeOpacity={0.7}
                >
                    <Ionicons name="star" size={16} color="#7C3AED" />
                    <Text style={[styles.memberCtaText, { color: '#7C3AED' }]}>
                        {isHindi ? 'निकासी के लिए सदस्य बनें' : 'Become a member to withdraw'}
                    </Text>
                </TouchableOpacity>
            )}

            <FlatList
                data={listData}
                keyExtractor={(_, i) => `w-${i}`}
                renderItem={renderItem}
                contentContainerStyle={{ padding: 12, paddingBottom: 32 }}
                ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[ACCENT]} tintColor={ACCENT} />
                }
            />
            <BottomSheetMessage
                visible={sheetVisible}
                onClose={() => setSheetVisible(false)}
                type={sheet.type}
                title={sheet.title}
                message={sheet.message}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    headerWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 12,
    },
    backBtn: { marginRight: 8, padding: 4 },
    headerTitle: { fontSize: 20, fontWeight: '900', letterSpacing: 0.5 },
    balanceCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 18,
        borderRadius: 16,
        borderWidth: 1,
    },
    balanceLabel: { fontSize: 12, fontWeight: '600' },
    balanceAmount: { fontSize: 28, fontWeight: '900', marginTop: 2 },
    statLabel: { fontSize: 10, fontWeight: '600' },
    statValue: { fontSize: 13, fontWeight: '800' },
    formCard: {
        padding: 16,
        borderRadius: 14,
        borderWidth: 1,
    },
    formTitle: { fontSize: 16, fontWeight: '800', marginBottom: 12 },
    input: {
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
        fontSize: 14,
        marginBottom: 10,
    },
    withdrawBtn: {
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 4,
    },
    withdrawBtnText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
    sectionHeader: {
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        paddingHorizontal: 4,
        paddingTop: 8,
    },
    emptyCard: {
        padding: 20,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: 'center',
    },
    txnCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
    },
    txnTitle: { fontSize: 15, fontWeight: '800' },
    txnSub: { fontSize: 12, marginTop: 2 },
    txnDate: { fontSize: 11 },
    statusPill: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
    },
    statusText: { fontSize: 11, fontWeight: '700' },
    memberCta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginHorizontal: 12,
        marginBottom: 4,
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 10,
        borderWidth: 1,
    },
    memberCtaText: { fontSize: 13, fontWeight: '700' },
});
