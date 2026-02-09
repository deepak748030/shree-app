import { useLanguage } from '@/contexts/language-context';
import { useAppTheme } from '@/contexts/theme-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import {
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const TEXT_DARK = '#333333';
const GREEN_BG = '#4CAF50';
const GREEN_LIGHT = '#E8F5E9';

const top200Users = [
    { rank: 1, name: 'Narayan Solanki', location: 'Chittorgarh', malas: '16469' },
    { rank: 2, name: 'Ramswroop Gurjar', location: 'Sawai Madhopur', malas: '12905' },
    { rank: 3, name: 'Naresh Bhati', location: 'Dhar', malas: '12305' },
    { rank: 4, name: 'Ramvir Ahirwar Bijori', location: 'Ashoknagar', malas: '11828' },
    { rank: 5, name: 'Radhamohanju', location: 'Shrivrindavan...', malas: '11267' },
    { rank: 6, name: 'Krishan Pal Guleria', location: 'Mandi Hp', malas: '10862' },
    { rank: 7, name: 'Debapriya Parida', location: 'Odisha', malas: '10012' },
    { rank: 8, name: 'Kisoriji', location: 'U P', malas: '9527' },
    { rank: 9, name: 'Pankaj Kumar Pandit', location: 'Jharkhand Giridih', malas: '9267' },
    { rank: 10, name: 'Kailash Tripathi', location: 'Santkabirnagar', malas: '9255' },
];

interface AnalyticsSheetProps {
    visible: boolean;
    onClose: () => void;
}

export default function AnalyticsSheet({ visible, onClose }: AnalyticsSheetProps) {
    const [activeTab, setActiveTab] = React.useState<'daily' | 'weekly' | 'monthly'>('weekly');
    const { theme } = useAppTheme();
    const { t } = useLanguage();

    const YELLOW_LIGHT = theme.bgCream;
    const YELLOW_BG = theme.headerBg;

    const worldwideStats = [
        { labelKey: 'analytics_all_time_users', value: '11,32,088', bg: YELLOW_LIGHT, borderColor: theme.cardBorder },
        { labelKey: 'analytics_all_time_malas', value: '1,00,33,10,084', bg: YELLOW_LIGHT, borderColor: theme.cardBorder },
        { labelKey: 'analytics_users_week', value: '97,501', bg: GREEN_LIGHT, borderColor: GREEN_BG },
        { labelKey: 'analytics_malas_week', value: '2,60,28,938', bg: GREEN_LIGHT, borderColor: GREEN_BG },
        { labelKey: 'analytics_users_month', value: '1,02,234', bg: YELLOW_LIGHT, borderColor: theme.cardBorder },
        { labelKey: 'analytics_malas_month', value: '3,04,95,724', bg: YELLOW_LIGHT, borderColor: theme.cardBorder },
    ];

    const tabKeys = [
        { id: 'daily' as const, key: 'analytics_daily' },
        { id: 'weekly' as const, key: 'analytics_weekly' },
        { id: 'monthly' as const, key: 'analytics_monthly' },
    ];

    return (
        <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
            <View style={[styles.container, { backgroundColor: YELLOW_LIGHT }]}>
                <View style={[styles.header, { backgroundColor: YELLOW_BG }]}>
                    <TouchableOpacity onPress={onClose} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={24} color={TEXT_DARK} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{t('analytics_header')}</Text>
                    <View style={{ width: 32 }} />
                </View>

                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.rankBadge}>
                        <Text style={styles.rankBadgeLabel}>{t('analytics_my_rank')}</Text>
                        <Text style={styles.rankBadgeValue}>⭐ 1,13,413 / 1,30,386</Text>
                    </View>

                    <Text style={styles.sectionTitle}>{t('analytics_worldwide')}</Text>
                    <View style={styles.statsGrid}>
                        {worldwideStats.map((stat, index) => (
                            <View
                                key={index}
                                style={[styles.statCard, { backgroundColor: stat.bg, borderColor: stat.borderColor }]}
                            >
                                <Text style={styles.statLabel}>{t(stat.labelKey as any)}</Text>
                                <Text style={styles.statValue}>{stat.value}</Text>
                            </View>
                        ))}
                    </View>

                    <Text style={styles.sectionTitle}>{t('analytics_top_200')}</Text>
                    <View style={styles.tableContainer}>
                        <View style={styles.tableHeader}>
                            <Text style={[styles.tableHeaderText, { width: 24 }]}>#</Text>
                            <Text style={[styles.tableHeaderText, { flex: 1 }]}>{t('analytics_user')}</Text>
                            <Text style={[styles.tableHeaderText, { width: 90, textAlign: 'center' }]}>{t('analytics_location')}</Text>
                            <Text style={[styles.tableHeaderText, { width: 50, textAlign: 'right' }]}>{t('analytics_malas')}</Text>
                        </View>
                        {top200Users.map((user, index) => (
                            <View
                                key={user.rank}
                                style={[styles.tableRow, index < top200Users.length - 1 && styles.tableRowBorder]}
                            >
                                <Text style={[styles.tableCell, { width: 24 }]}>{user.rank}.</Text>
                                <Text style={[styles.tableCellName, { flex: 1 }]} numberOfLines={1}>{user.name}</Text>
                                <Text style={[styles.tableCell, { width: 90, textAlign: 'center', fontSize: 11 }]} numberOfLines={1}>{user.location}</Text>
                                <Text style={[styles.tableCellMalas, { width: 50, textAlign: 'right' }]}>{user.malas}</Text>
                            </View>
                        ))}
                        <Text style={styles.lastUpdated}>{t('analytics_last_updated')}: 07 Feb at 6:15 PM</Text>
                        <TouchableOpacity style={styles.viewMoreBtn}>
                            <Text style={styles.viewMoreText}>{t('analytics_view_more')}</Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.sectionTitle}>{t('analytics_passbook')}</Text>
                    <View style={styles.passbookCard}>
                        <View style={styles.passbookHighlight}>
                            <Text style={styles.fireEmoji}>🔥</Text>
                            <Text style={styles.passbookHighlightText}>{t('analytics_highest_mala')}</Text>
                        </View>
                        <Text style={styles.passbookHighlightValue}>1</Text>

                        <View style={styles.tabRow}>
                            {tabKeys.map((tab) => (
                                <TouchableOpacity
                                    key={tab.id}
                                    style={[styles.tab, activeTab === tab.id && styles.tabActive]}
                                    onPress={() => setActiveTab(tab.id)}
                                >
                                    {activeTab === tab.id && (
                                        <Ionicons name="checkmark" size={14} color={GREEN_BG} style={{ marginRight: 4 }} />
                                    )}
                                    <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
                                        {t(tab.key as any)}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                            <TouchableOpacity style={styles.chartIconBtn}>
                                <Ionicons name="bar-chart-outline" size={20} color={TEXT_DARK} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.entryRow}>
                            <View style={styles.entryLeft}>
                                <MaterialCommunityIcons name="meditation" size={20} color={TEXT_DARK} />
                                <Text style={styles.entryText}>2 {t('analytics_mala_unit')}</Text>
                            </View>
                            <Text style={styles.entryDate}>02 Feb - 08 Feb</Text>
                        </View>
                    </View>

                    <Text style={styles.disclaimer}>{t('analytics_disclaimer')}</Text>
                </ScrollView>
            </View>
        </Modal>
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
    },
    backBtn: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: TEXT_DARK,
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 6,
        paddingBottom: 40,
    },
    rankBadge: {
        alignSelf: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        paddingVertical: 8,
        paddingHorizontal: 18,
        alignItems: 'center',
        marginVertical: 6,
        borderWidth: 1,
        borderColor: '#333333',
    },
    rankBadgeLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: TEXT_DARK,
    },
    rankBadgeValue: {
        fontSize: 15,
        fontWeight: 'bold',
        color: TEXT_DARK,
        marginTop: 2,
    },
    sectionTitle: {
        fontSize: 17,
        fontWeight: 'bold',
        color: TEXT_DARK,
        textAlign: 'center',
        marginTop: 6,
        marginBottom: 6,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    statCard: {
        width: '48%',
        borderRadius: 10,
        paddingVertical: 10,
        paddingHorizontal: 12,
        marginBottom: 6,
        borderWidth: 1.5,
    },
    statLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: TEXT_DARK,
    },
    statValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: TEXT_DARK,
        marginTop: 2,
    },
    tableContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: '#333333',
        overflow: 'hidden',
        marginBottom: 6,
    },
    tableHeader: {
        flexDirection: 'row',
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderBottomWidth: 1.5,
        borderBottomColor: '#333333',
        backgroundColor: '#FFFFFF',
    },
    tableHeaderText: {
        fontSize: 13,
        fontWeight: 'bold',
        color: TEXT_DARK,
    },
    tableRow: {
        flexDirection: 'row',
        paddingVertical: 8,
        paddingHorizontal: 10,
        alignItems: 'center',
    },
    tableRowBorder: {
        borderBottomWidth: 0.5,
        borderBottomColor: 'rgba(0,0,0,0.1)',
    },
    tableCell: {
        fontSize: 13,
        color: TEXT_DARK,
    },
    tableCellName: {
        fontSize: 13,
        fontWeight: '600',
        color: TEXT_DARK,
    },
    tableCellMalas: {
        fontSize: 13,
        fontWeight: 'bold',
        color: TEXT_DARK,
    },
    lastUpdated: {
        fontSize: 11,
        color: TEXT_DARK,
        opacity: 0.6,
        textAlign: 'center',
        paddingVertical: 6,
    },
    viewMoreBtn: {
        alignSelf: 'center',
        borderWidth: 1.5,
        borderColor: '#333333',
        borderRadius: 20,
        paddingVertical: 6,
        paddingHorizontal: 22,
        marginBottom: 10,
    },
    viewMoreText: {
        fontSize: 13,
        fontWeight: '600',
        color: TEXT_DARK,
    },
    passbookCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: '#333333',
        paddingVertical: 10,
        paddingHorizontal: 6,
        marginBottom: 6,
    },
    passbookHighlight: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    fireEmoji: {
        fontSize: 18,
        marginRight: 6,
    },
    passbookHighlightText: {
        fontSize: 14,
        fontWeight: '600',
        color: TEXT_DARK,
    },
    passbookHighlightValue: {
        fontSize: 28,
        fontWeight: 'bold',
        color: TEXT_DARK,
        textAlign: 'center',
        marginVertical: 4,
    },
    tabRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 6,
    },
    tab: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.15)',
        borderRadius: 16,
        paddingVertical: 5,
        paddingHorizontal: 14,
        marginRight: 6,
    },
    tabActive: {
        borderColor: GREEN_BG,
    },
    tabText: {
        fontSize: 13,
        color: TEXT_DARK,
    },
    tabTextActive: {
        color: GREEN_BG,
        fontWeight: '600',
    },
    chartIconBtn: {
        marginLeft: 'auto',
        padding: 4,
    },
    entryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 6,
        borderTopWidth: 0.5,
        borderTopColor: 'rgba(0,0,0,0.1)',
        marginTop: 4,
    },
    entryLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    entryText: {
        fontSize: 14,
        color: TEXT_DARK,
        marginLeft: 8,
    },
    entryDate: {
        fontSize: 12,
        color: TEXT_DARK,
        opacity: 0.6,
    },
    disclaimer: {
        fontSize: 10,
        color: TEXT_DARK,
        opacity: 0.5,
        marginTop: 4,
        paddingHorizontal: 6,
    },
});
