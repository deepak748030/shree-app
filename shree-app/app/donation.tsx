import BottomSheetMessage from '@/components/ui/bottom-sheet-message';
import { useLanguage } from '@/contexts/language-context';
import { useAppTheme } from '@/contexts/theme-context';
import { fetchDonationSettings } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface DonationData {
    upiId: string;
    accountNumber: string;
    ifscCode: string;
    accountHolderName: string;
    bankName: string;
    scannerImage: string;
    note_hi: string;
    note_en: string;
    isActive: boolean;
}

export default function DonationScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { theme } = useAppTheme();
    const { language, t } = useLanguage();
    const [data, setData] = useState<DonationData | null>(null);
    const [loading, setLoading] = useState(true);
    const [sheetMsg, setSheetMsg] = useState<{ visible: boolean; type: 'success' | 'error' | 'info'; title: string; message: string }>({
        visible: false, type: 'info', title: '', message: '',
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const result = await fetchDonationSettings();
            setData(result);
        } catch { }
        setLoading(false);
    };

    const copyToClipboard = async (text: string, label: string) => {
        await Clipboard.setStringAsync(text);
        setSheetMsg({
            visible: true,
            type: 'success',
            title: language === 'hi' ? 'कॉपी हुआ' : 'Copied',
            message: language === 'hi' ? `${label} कॉपी हो गया` : `${label} copied to clipboard`,
        });
    };

    const note = language === 'hi' ? data?.note_hi : data?.note_en;

    return (
        <View style={[styles.container, { backgroundColor: theme.bgCream, paddingTop: insets.top }]}>
            <StatusBar style={theme.isDark ? 'light' : 'dark'} backgroundColor={theme.headerBg} translucent={false} />
            {/* Header */}
            <View style={[styles.header, { backgroundColor: theme.headerBg, borderBottomColor: theme.cardBorder }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
                    <Ionicons name="arrow-back" size={22} color={theme.headerText} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.headerText }]}>
                    {language === 'hi' ? 'दान करें' : 'Donate'}
                </Text>
                <View style={{ width: 34 }} />
            </View>

            {loading ? (
                <View style={styles.loaderWrap}>
                    <ActivityIndicator size="large" color={theme.accent} />
                </View>
            ) : !data || !data.isActive ? (
                <View style={styles.emptyWrap}>
                    <Ionicons name="heart-outline" size={48} color={theme.subText} />
                    <Text style={[styles.emptyText, { color: theme.subText }]}>
                        {language === 'hi' ? 'अभी दान की सुविधा उपलब्ध नहीं है' : 'Donation is not available right now'}
                    </Text>
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {note ? (
                        <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.accent + '40' }]}>
                            <Ionicons name="heart" size={20} color={theme.accent} />
                            <Text style={[styles.noteText, { color: theme.text }]}>{note}</Text>
                        </View>
                    ) : null}

                    {data.scannerImage ? (
                        <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, alignItems: 'center' }]}>
                            <Text style={[styles.sectionTitle, { color: theme.text }]}>
                                {language === 'hi' ? 'QR कोड से दान करें' : 'Scan QR to Donate'}
                            </Text>
                            <Image source={{ uri: data.scannerImage }} style={styles.qrImage} contentFit="contain" />
                        </View>
                    ) : null}

                    {data.upiId ? (
                        <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
                            <View style={styles.sectionHeader}>
                                <Ionicons name="phone-portrait-outline" size={18} color={theme.accent} />
                                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                                    {language === 'hi' ? 'UPI से दान करें' : 'Donate via UPI'}
                                </Text>
                            </View>
                            <CopyRow label="UPI ID" value={data.upiId} onCopy={() => copyToClipboard(data.upiId, 'UPI ID')} theme={theme} />
                        </View>
                    ) : null}

                    {data.accountNumber ? (
                        <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
                            <View style={styles.sectionHeader}>
                                <Ionicons name="business-outline" size={18} color={theme.accent} />
                                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                                    {language === 'hi' ? 'बैंक खाते में दान करें' : 'Bank Transfer'}
                                </Text>
                            </View>
                            {data.accountHolderName ? (
                                <CopyRow label={language === 'hi' ? 'खाताधारक' : 'Account Holder'} value={data.accountHolderName} onCopy={() => copyToClipboard(data.accountHolderName, 'Name')} theme={theme} />
                            ) : null}
                            {data.bankName ? (
                                <CopyRow label={language === 'hi' ? 'बैंक' : 'Bank'} value={data.bankName} onCopy={() => copyToClipboard(data.bankName, 'Bank')} theme={theme} />
                            ) : null}
                            <CopyRow label={language === 'hi' ? 'खाता संख्या' : 'Account No.'} value={data.accountNumber} onCopy={() => copyToClipboard(data.accountNumber, 'Account No.')} theme={theme} />
                            {data.ifscCode ? (
                                <CopyRow label="IFSC" value={data.ifscCode} onCopy={() => copyToClipboard(data.ifscCode, 'IFSC')} theme={theme} />
                            ) : null}
                        </View>
                    ) : null}
                </ScrollView>
            )}

            <BottomSheetMessage
                visible={sheetMsg.visible}
                onClose={() => setSheetMsg(prev => ({ ...prev, visible: false }))}
                type={sheetMsg.type}
                title={sheetMsg.title}
                message={sheetMsg.message}
            />
        </View>
    );
}

function CopyRow({ label, value, onCopy, theme }: { label: string; value: string; onCopy: () => void; theme: any }) {
    return (
        <View style={[styles.copyRow, { borderBottomColor: theme.divider }]}>
            <View style={{ flex: 1 }}>
                <Text style={[styles.copyLabel, { color: theme.subText }]}>{label}</Text>
                <Text style={[styles.copyValue, { color: theme.text }]}>{value}</Text>
            </View>
            <TouchableOpacity onPress={onCopy} style={[styles.copyBtn, { backgroundColor: theme.accent + '22' }]} activeOpacity={0.7}>
                <Ionicons name="copy-outline" size={16} color={theme.accent} />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 6,
        paddingVertical: 10,
        borderBottomWidth: 1,
    },
    backBtn: {
        width: 34, height: 34, borderRadius: 17,
        alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: { fontSize: 17, fontWeight: 'bold' },
    loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    emptyText: { fontSize: 14, textAlign: 'center', paddingHorizontal: 6 },
    scrollContent: { paddingHorizontal: 6, paddingTop: 6, paddingBottom: 24, gap: 6 },
    card: { borderRadius: 12, padding: 12, borderWidth: 1 },
    noteText: { fontSize: 14, lineHeight: 20, marginTop: 4 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
    sectionTitle: { fontSize: 15, fontWeight: '700' },
    qrImage: { width: 220, height: 220, borderRadius: 8, marginTop: 8 },
    copyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1 },
    copyLabel: { fontSize: 11, marginBottom: 1 },
    copyValue: { fontSize: 14, fontWeight: '600' },
    copyBtn: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});
