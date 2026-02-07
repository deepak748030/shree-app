import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import {
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

const YELLOW_BG = '#FFEB3B';
const YELLOW_LIGHT = '#FFF9C4';
const TEXT_DARK = '#333333';
const GREEN_BG = '#4CAF50';
const GREEN_LIGHT = '#E8F5E9';

const worldwideStats = [
    { label: 'All-Time Users', value: '11,32,088', bg: YELLOW_LIGHT, borderColor: '#E0D6A0' },
    { label: 'All-Time Malas', value: '1,00,33,10,084', bg: YELLOW_LIGHT, borderColor: '#E0D6A0' },
    { label: 'Users This Week', value: '97,501', bg: GREEN_LIGHT, borderColor: GREEN_BG },
    { label: 'Malas This Week', value: '2,60,28,938', bg: GREEN_LIGHT, borderColor: GREEN_BG },
    { label: 'Users This Month', value: '1,02,234', bg: YELLOW_LIGHT, borderColor: '#E0D6A0' },
    { label: 'Malas This Month', value: '3,04,95,724', bg: YELLOW_LIGHT, borderColor: '#E0D6A0' },
];

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
    const [activeTab, setActiveTab] = React.useState<'Daily' | 'Weekly' | 'Monthly'>('Weekly');

    return (
        <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={24} color={TEXT_DARK} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Analytics</Text>
                    <View style={{ width: 32 }} />
                </View>

                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* My Rank */}
                    <View style={styles.rankBadge}>
                        <Text style={styles.rankBadgeLabel}>My Rank this Week</Text>
                        <Text style={styles.rankBadgeValue}>⭐ 1,13,413 / 1,30,386</Text>
                    </View>

                    {/* Worldwide Japa Tracker */}
                    <Text style={styles.sectionTitle}>Worldwide Japa Tracker</Text>
                    <View style={styles.statsGrid}>
                        {worldwideStats.map((stat, index) => (
                            <View
                                key={index}
                                style={[
                                    styles.statCard,
                                    { backgroundColor: stat.bg, borderColor: stat.borderColor },
                                ]}
                            >
                                <Text style={styles.statLabel}>{stat.label}</Text>
                                <Text style={styles.statValue}>{stat.value}</Text>
                            </View>
                        ))}
                    </View>

                    {/* Top 200 Users */}
                    <Text style={styles.sectionTitle}>Top 200 Users This Week</Text>
                    <View style={styles.tableContainer}>
                        {/* Table Header */}
                        <View style={styles.tableHeader}>
                            <Text style={[styles.tableHeaderText, { width: 24 }]}>#</Text>
                            <Text style={[styles.tableHeaderText, { flex: 1 }]}>User</Text>
                            <Text style={[styles.tableHeaderText, { width: 90, textAlign: 'center' }]}>Location</Text>
                            <Text style={[styles.tableHeaderText, { width: 50, textAlign: 'right' }]}>Malas</Text>
                        </View>
                        {top200Users.map((user, index) => (
                            <View
                                key={user.rank}
                                style={[
                                    styles.tableRow,
                                    index < top200Users.length - 1 && styles.tableRowBorder,
                                ]}
                            >
                                <Text style={[styles.tableCell, { width: 24 }]}>{user.rank}.</Text>
                                <Text style={[styles.tableCellName, { flex: 1 }]} numberOfLines={1}>
                                    {user.name}
                                </Text>
                                <Text style={[styles.tableCell, { width: 90, textAlign: 'center', fontSize: 11 }]} numberOfLines={1}>
                                    {user.location}
                                </Text>
                                <Text style={[styles.tableCellMalas, { width: 50, textAlign: 'right' }]}>
                                    {user.malas}
                                </Text>
                            </View>
                        ))}
                        <Text style={styles.lastUpdated}>Last updated: 07 Feb at 6:15 PM</Text>
                        <TouchableOpacity style={styles.viewMoreBtn}>
                            <Text style={styles.viewMoreText}>View More</Text>
                        </TouchableOpacity>
                    </View>

                    {/* My Passbook */}
                    <Text style={styles.sectionTitle}>My नाम जप Passbook</Text>
                    <View style={styles.passbookCard}>
                        <View style={styles.passbookHighlight}>
                            <Text style={styles.fireEmoji}>🔥</Text>
                            <Text style={styles.passbookHighlightText}>My Highest Mala Count In A Day</Text>
                        </View>
                        <Text style={styles.passbookHighlightValue}>1</Text>

                        {/* Tabs */}
                        <View style={styles.tabRow}>
                            {(['Daily', 'Weekly', 'Monthly'] as const).map((tab) => (
                                <TouchableOpacity
                                    key={tab}
                                    style={[styles.tab, activeTab === tab && styles.tabActive]}
                                    onPress={() => setActiveTab(tab)}
                                >
                                    {activeTab === tab && (
                                        <Ionicons name="checkmark" size={14} color={GREEN_BG} style={{ marginRight: 4 }} />
                                    )}
                                    <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                                        {tab}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                            <TouchableOpacity style={styles.chartIconBtn}>
                                <Ionicons name="bar-chart-outline" size={20} color={TEXT_DARK} />
                            </TouchableOpacity>
                        </View>

                        {/* Entry */}
                        <View style={styles.entryRow}>
                            <View style={styles.entryLeft}>
                                <MaterialCommunityIcons name="meditation" size={20} color={TEXT_DARK} />
                                <Text style={styles.entryText}>2 mala</Text>
                            </View>
                            <Text style={styles.entryDate}>02 Feb - 08 Feb</Text>
                        </View>
                    </View>

                    {/* Disclaimer */}
                    <Text style={styles.disclaimer}>
                        **Your mala count data will be deleted if you uninstall the app or clear app data.
                    </Text>
                    <Text style={styles.disclaimer}>
                        **यदि आप ऐप को अनइंस्टॉल करते हैं या ऐप डेटा क्लियर/डिलीट करते हैं, तो आपकी माला संख्या का डेटा डिलीट हो जाएगा।
                    </Text>
                </ScrollView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: YELLOW_LIGHT,
    },
    header: {
        backgroundColor: YELLOW_BG,
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
