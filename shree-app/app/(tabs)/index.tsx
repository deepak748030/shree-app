import ImageSlider from '@/components/image-slider';
import SidebarDrawer from '@/components/sidebar-drawer';
import TextSizeSlider from '@/components/text-size-slider';
import { homeContent } from '@/constants/translations';
import { useLanguage } from '@/contexts/language-context';
import { useAppTheme } from '@/contexts/theme-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const HP = 6;
const TEXT_DARK = '#333333';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useAppTheme();
  const { language, t } = useLanguage();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [fontSize, setFontSize] = useState(15);
  const [scrollEnabled, setScrollEnabled] = useState(true);

  const content = homeContent[language];

  return (
    <View style={[styles.container, { backgroundColor: theme.bgCream }]}>
      <StatusBar style="dark" backgroundColor={theme.headerBg} translucent={false} />

      <View style={[styles.statusBarBg, { backgroundColor: theme.headerBg, paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => setDrawerVisible(true)}
          >
            <Ionicons name="menu" size={26} color={TEXT_DARK} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('app_name')}</Text>
          <View style={{ width: 26 }} />
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        scrollEnabled={scrollEnabled}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <ImageSlider />

        <View style={styles.contentContainer}>
          <View style={styles.controlsWrapper}>
            <View style={styles.textSizeRow}>
              <TextSizeSlider
                value={fontSize}
                onValueChange={setFontSize}
                onSlidingStart={() => setScrollEnabled(false)}
                onSlidingEnd={() => setScrollEnabled(true)}
              />
            </View>
          </View>

          <Text style={[styles.contentTitle, { color: theme.accent }]}>{content.title}</Text>
          <Text style={styles.contentSubtitle}>{content.subtitle}</Text>

          {content.paragraphs.map((para, index) => (
            <Text
              key={index}
              style={[
                styles.paragraph,
                { fontSize: fontSize, lineHeight: fontSize * 1.75 },
              ]}
            >
              {para}
            </Text>
          ))}
        </View>
      </ScrollView>

      <SidebarDrawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  statusBarBg: {},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: HP,
    paddingVertical: 10,
  },
  menuButton: {
    padding: 2,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  contentContainer: {
    paddingHorizontal: HP,
    paddingTop: 6,
  },
  controlsWrapper: {
    marginBottom: 6,
  },
  textSizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  contentTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  contentSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    color: '#E65100',
    fontStyle: 'italic',
    marginBottom: 12,
  },
  paragraph: {
    textAlign: 'justify',
    color: '#333333',
    marginBottom: 6,
  },
});
