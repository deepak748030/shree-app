import BottomSheetMessage from '@/components/ui/bottom-sheet-message';
import { useLanguage } from '@/contexts/language-context';
import { useAppTheme } from '@/contexts/theme-context';
import { fetchDonationSettings } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
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

const TEXT_DARK = '#333333';

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
        <View style={[styles.container, { backgroundColor: theme.headerBg, paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
                    <Ionicons name="arrow-back" size={22} color={TEXT_DARK} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>
                    {language === 'hi' ? 'दान करें' : 'Donate'}
                </Text>
                <View style={{ width: 34 }} />
            </View>

            {loading ? (
                <View style={styles.loaderWrap}>
                    <ActivityIndicator size="large" color={theme.primary} />
                </View>
            ) : !data || !data.isActive ? (
                <View style={styles.emptyWrap}>
                    <Ionicons name="heart-outline" size={48} color="#999" />
                    <Text style={styles.emptyText}>
                        {language === 'hi' ? 'अभी दान की सुविधा उपलब्ध नहीं है' : 'Donation is not available right now'}
                    </Text>
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Note */}
                    {note ? (
                        <View style={[styles.card, { borderColor: theme.primary + '30' }]}>
                            <Ionicons name="heart" size={20} color={theme.primary} />
                            <Text style={styles.noteText}>{note}</Text>
                        </View>
                    ) : null}

                    {/* QR Scanner */}
                    {data.scannerImage ? (
                        <View style={[styles.card, { alignItems: 'center' }]}>
                            <Text style={styles.sectionTitle}>
                                {language === 'hi' ? 'QR कोड से दान करें' : 'Scan QR to Donate'}
                            </Text>
                            <Image
                                source={{ uri: data.scannerImage }}
                                style={styles.qrImage}
                                contentFit="contain"
                            />
                        </View>
                    ) : null}

                    {/* UPI */}
                    {data.upiId ? (
                        <View style={styles.card}>
                            <View style={styles.sectionHeader}>
                                <Ionicons name="phone-portrait-outline" size={18} color={theme.primary} />
                                <Text style={styles.sectionTitle}>
                                    {language === 'hi' ? 'UPI से दान करें' : 'Donate via UPI'}
                                </Text>
                            </View>
                            <CopyRow label="UPI ID" value={data.upiId} onCopy={() => copyToClipboard(data.upiId, 'UPI ID')} theme={theme} />
                        </View>
                    ) : null}

                    {/* Bank Details */}
                    {data.accountNumber ? (
                        <View style={styles.card}>
                            <View style={styles.sectionHeader}>
                                <Ionicons name="business-outline" size={18} color={theme.primary} />
                                <Text style={styles.sectionTitle}>
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
        <View style={styles.copyRow}>
            <View style={{ flex: 1 }}>
                <Text style={styles.copyLabel}>{label}</Text>
                <Text style={styles.copyValue}>{value}</Text>
            </View>
            <TouchableOpacity onPress={onCopy} style={[styles.copyBtn, { backgroundColor: theme.primary + '15' }]} activeOpacity={0.7}>
                <Ionicons name="copy-outline" size={16} color={theme.primary} />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 6,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.06)',
    },
    backBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: 'bold',
        color: TEXT_DARK,
    },
    loaderWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    emptyText: {
        fontSize: 14,
        color: '#999',
        textAlign: 'center',
        paddingHorizontal: 6,
    },
    scrollContent: {
        paddingHorizontal: 6,
        paddingTop: 6,
        paddingBottom: 24,
        gap: 6,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.08)',
    },
    noteText: {
        fontSize: 14,
        color: TEXT_DARK,
        lineHeight: 20,
        marginTop: 4,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 8,
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: TEXT_DARK,
    },
    qrImage: {
        width: 220,
        height: 220,
        borderRadius: 8,
        marginTop: 8,
    },
    copyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.04)',
    },
    copyLabel: {
        fontSize: 11,
        color: '#888',
        marginBottom: 1,
    },
    copyValue: {
        fontSize: 14,
        color: TEXT_DARK,
        fontWeight: '600',
    },
    copyBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
