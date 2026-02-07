import ImageSlider from '@/components/image-slider';
import SidebarDrawer from '@/components/sidebar-drawer';
import TextSizeSlider from '@/components/text-size-slider';
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

const YELLOW_BG = '#FFEB3B';
const YELLOW_DARK = '#F9A825';
const TEXT_DARK = '#333333';
const TEXT_BROWN = '#5D4037';
const ACCENT_ORANGE = '#E65100';
const BG_CREAM = '#FFFDE7';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [language, setLanguage] = useState<'hindi' | 'english'>('hindi');
  const [fontSize, setFontSize] = useState(15);
  const [scrollEnabled, setScrollEnabled] = useState(true);

  const hindiContent = {
    title: 'भगवद् प्राप्ति दुर्लभ नहीं, दुर्लभ है भगवद् प्राप्त महापुरुषों का मिलना',
    subtitle: '(पूज्य श्री हित प्रेमानन्द गोविन्द शरण जी महाराज)',
    paragraphs: [
      'श्री धाम वृंदावन में विराजमान श्रीश्यामा-श्याम के नाम, रूप, लीला, धाम निष्ठ रसिक संत श्री हित प्रेमानन्द गोविन्द शरण जी महाराज अध्यात्म जगत् की एक विशिष्टतम विभूति हैं। वह निरन्तर अपने सत्संग व सद्विचारों के द्वारा परमार्थ पथ की ओर अगसर साधकों का मार्गदर्शन कर रहे हैं एवं व्यवहार-प्रपंच, विषय-भोगों में फंसे लोगों में आध्यात्मिक चेतना का संचार कर रहे हैं।',
      'पूज्य महाराज जी भगवत् साक्षात्कार की प्रबल लालसा लेकर 13 वर्ष की अल्पायु में ही गृहत्याग कर साधन पथ पर चल पड़े थे तथा उन्होंने सन्यास लेकर अपना अधिकांश जीवन ब्रह्मबोध प्राप्ति की इच्छा से उत्कट वैराग्य पूर्वक गंगा किनारे व्यतीत किया। कालान्तर में काशी में आयोजित श्रीयुगल सरकार श्यामा-श्याम की रासलीला से आकर्षित होकर विश्वनाथ भगवान् की प्रेरणा से वे काशी से वृंदावन आये और विगत कई वर्षों से धाम निष्ठा के साथ श्रीहित हरिवंश महाप्रभु द्वारा प्रकट प्रिया-प्रियतम की रसोपासना में निमग्न हैं।',
      'महाराज श्री को अपना भारत देश बहुत प्रिय है और उनका एकमात्र लक्ष्य यही है कि हमारे देशवासी अशान्ति, दु:ख, कलेश और भय प्रदान करने वाले असत् आचरणों (जुआ, मांस-मदिरा, हिंसा, व्यभिचार आदि) का त्याग कर, अपने कर्तव्य कर्मों का दृढ़तापूर्वक भगवद् समर्पित करते हुए पालन करें एवं इस संसार में भी सुख-शान्तिमय जीवन व्यतीत कर मानव जीवन के चरम लक्ष्य भवबंधन से मुक्ति अर्थात् भगवान् की प्राप्ति करें।',
      'महाराज जी भगवद् प्राप्ति करने के लिए सभी को समान रूप से पात्र मानते हैं। उनका कहना है कि हम सभी भगवान् के अंश हैं और प्रभु की प्राप्ति करने में समानाधिकार रखते हैं अर्थात् प्रभु के प्रेम की प्राप्ति या भगवद् प्राप्ति में किसी प्रकार का भेदभाव नहीं है।',
      'महाराज श्री समस्त शास्त्रों, सिद्धान्तों व उपदेशों का सार यही बताते हैं कि भगवद् आश्रित होकर निरन्तर भगवान् के नाम का जप करते रहो, मंगलमय प्रभु के प्रत्येक विधान में संतुष्ट रहो, गन्दे आचरणों का त्याग करो एवं भगवद् भाव से सबकी सेवा करो।',
    ],
  };

  const englishContent = {
    title: 'It is not difficult to attain God, but it is rare to meet God-realized saints',
    subtitle: '(Pujya Shri Hit Premanand Govind Sharan Ji Maharaj)',
    paragraphs: [
      'Shri Hit Premanand Govind Sharan Ji Maharaj, residing in the sacred land of Vrindavan, is one of the most distinguished spiritual luminaries of the spiritual world. He is a devotee immersed in the name, form, pastimes, and divine abode of Shri Shyama-Shyam.',
      'Pujya Maharaj Ji left home at the tender age of 13 with an intense desire for divine realization and took sanyas, spending most of his life in intense renunciation along the banks of the Ganga. Later, attracted by the Raslila of Shri Yugal Sarkar Shyama-Shyam organized in Kashi, and inspired by Lord Vishwanath, he came from Kashi to Vrindavan.',
      'Maharaj Shri loves his country India dearly, and his sole aim is that our countrymen should give up sinful activities and surrender their duties to the Lord, living a peaceful and happy life while attaining the ultimate goal of liberation from worldly bondage.',
      'Maharaj Ji considers everyone equally eligible for attaining God. He says that we are all parts of the Lord and have equal rights in attaining His love and grace, without any discrimination.',
      'Maharaj Shri explains the essence of all scriptures: take shelter of the Lord, constantly chant His name, remain content in His divine will, give up impure conduct, and serve everyone with devotion.',
    ],
  };

  const content = language === 'hindi' ? hindiContent : englishContent;

  return (
    <View style={styles.container}>
      <StatusBar style="dark" backgroundColor={YELLOW_BG} translucent={false} />


      {/* Status bar background + Header */}
      <View style={[styles.statusBarBg, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => setDrawerVisible(true)}
          >
            <Ionicons name="menu" size={26} color={TEXT_DARK} />

          </TouchableOpacity>
          <Text style={styles.headerTitle}>श्री</Text>
          <View style={{ width: 26 }} />
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        scrollEnabled={scrollEnabled}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Image Slider */}
        <ImageSlider />

        <View style={styles.contentContainer}>
          {/* Language Toggle + Text Size Slider */}
          <View style={styles.controlsWrapper}>
            <View style={styles.languageToggle}>
              <TouchableOpacity
                style={[styles.langButton, language === 'hindi' && styles.langButtonActive]}
                onPress={() => setLanguage('hindi')}
              >
                <Text style={[styles.langButtonText, language === 'hindi' && styles.langButtonTextActive]}>
                  Hindi
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.langButton, language === 'english' && styles.langButtonActive]}
                onPress={() => setLanguage('english')}
              >
                <Text style={[styles.langButtonText, language === 'english' && styles.langButtonTextActive]}>
                  English
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.textSizeRow}>
              <TextSizeSlider
                value={fontSize}
                onValueChange={setFontSize}
                onSlidingStart={() => setScrollEnabled(false)}
                onSlidingEnd={() => setScrollEnabled(true)}
              />
            </View>
          </View>

          {/* Title - fixed size */}
          <Text style={styles.contentTitle}>{content.title}</Text>

          {/* Subtitle - fixed size */}
          <Text style={styles.contentSubtitle}>{content.subtitle}</Text>

          {/* Paragraphs - font size changes only here */}
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

      {/* Sidebar Drawer */}
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
    backgroundColor: BG_CREAM,
  },
  statusBarBg: {
    backgroundColor: YELLOW_BG,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: HP,
    paddingVertical: 10,
    backgroundColor: YELLOW_BG,
  },
  menuButton: {
    padding: 2,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: TEXT_DARK,
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
  languageToggle: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: YELLOW_DARK,
    marginBottom: 6,
  },
  langButton: {
    paddingVertical: 6,
    paddingHorizontal: 18,
    backgroundColor: 'transparent',
  },
  langButtonActive: {
    backgroundColor: YELLOW_DARK,
  },
  langButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_BROWN,
  },
  langButtonTextActive: {
    color: '#FFFFFF',
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
    color: TEXT_BROWN,
    marginBottom: 4,
  },
  contentSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    color: ACCENT_ORANGE,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  paragraph: {
    textAlign: 'justify',
    color: TEXT_DARK,
    marginBottom: 6,
  },
});
