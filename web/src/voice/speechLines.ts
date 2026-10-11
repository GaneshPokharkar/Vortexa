// Script for the pre-recorded tutor lines. Recorded once with ElevenLabs eleven_v4, voice Sanika (es0ipzX1rWO9Y2E2TbgY). English lesson lines are the C*-K card 'simple' text; Marathi is a draft translation (physics terms kept in English) awaiting teacher review. Re-record a clip if its text changes.
// Audio: web/public/speech/<id>-<lang>.mp3. A clip whose English no longer matches the app text is hidden (Speak.recorded).
export const SPEECH_LINES = {
  "lesson-C1": {
    en: "An oscillating body goes back and forth around the point where it would rest, called the mean position. How far it is from that point right now is its displacement. The farthest it ever gets from that point is the amplitude. So the amplitude is only half the gap between the two ends.",
    mr: "दोलन करणारी वस्तू ज्या बिंदूभोवती पुढे-मागे जाते, जिथे ती स्थिर राहिली असती, त्याला mean position म्हणतात. त्या बिंदूपासून ती आत्ता किती दूर आहे, ते तिचं displacement. त्या बिंदूपासून ती जास्तीत जास्त जितकी दूर जाते, ते amplitude. म्हणजे amplitude हे दोन टोकांमधील अंतराच्या फक्त अर्ध्याइतकं असतं.",
  },
  "lesson-C2": {
    en: "Think of a block on a spring. In the middle the spring is relaxed, so nothing pushes the block and it is moving fastest. At the ends it stops for an instant, but the spring is stretched most, so the pull back is strongest there.",
    mr: "Spring ला लावलेल्या block चा विचार करा. मधोमध spring सैल असते, त्यामुळे block ला काहीही ढकलत नाही आणि तो सर्वात वेगाने जात असतो. टोकांवर तो क्षणभर थांबतो, पण तिथे spring सर्वात जास्त ताणलेली असते, म्हणून मागे खेचणारं बल तिथे सर्वात जास्त असतं.",
  },
  "lesson-C3": {
    en: "The time period is the time for one full back-and-forth. Frequency is how many back-and-forths happen in one second. A heavier block on a spring swings slower, but a heavier pendulum bob does not. Pulling further does not change the time.",
    mr: "एक पूर्ण पुढे-मागे फेरी होण्यासाठी लागणारा वेळ म्हणजे time period. एका सेकंदात किती फेऱ्या होतात, ती frequency. Spring वरचा जड block हळू दोलन करतो, पण pendulum चा जड bob तसा करत नाही. जास्त ओढल्याने वेळ बदलत नाही.",
  },
  "lesson-C4": {
    en: "Pull a block on a spring and let go. The spring always pulls it back toward the middle. The farther you pull, the harder it pulls back. At the middle, the pull is zero.",
    mr: "Spring ला लावलेला block ओढा आणि सोडा. Spring त्याला नेहमी मध्याकडे परत खेचते. जितकं जास्त ओढाल, तितकं जास्त ती परत खेचते. मधोमध हे खेचणं शून्य असतं.",
  },
  "lesson-C5": {
    en: "A block on a spring keeps swapping two kinds of energy. In the middle it moves fastest, so it has the most kinetic energy and the spring stores none. At the ends it stops for an instant and the stretched spring stores all the energy. The total never changes if nothing rubs.",
    mr: "Spring वरचा block दोन प्रकारची ऊर्जा सतत अदलाबदल करत असतो. मधोमध तो सर्वात वेगाने जातो, म्हणून त्याच्याकडे सर्वात जास्त kinetic energy असते आणि spring मध्ये काहीच साठत नाही. टोकांवर तो क्षणभर थांबतो आणि ताणलेली spring सगळी ऊर्जा साठवते. काहीही घासत नसेल, तर एकूण ऊर्जा कधीच बदलत नाही.",
  },
  "lesson-C6": {
    en: "Light slows down in glass or water and speeds up again in air. Slowing down makes it bend toward the normal; speeding up makes it bend away. If light inside glass or water meets the surface at too steep an angle, it cannot get out and reflects back completely: total internal reflection.",
    mr: "काच किंवा पाण्यात प्रकाश हळू होतो आणि हवेत पुन्हा वेगवान होतो. हळू झाल्यावर तो normal कडे वाकतो; वेगवान झाल्यावर normal पासून दूर वाकतो. काच किंवा पाण्याच्या आतला प्रकाश पृष्ठभागावर खूप तिरक्या कोनात पोहोचला, तर तो बाहेर पडू शकत नाही आणि पूर्णपणे परत परावर्तित होतो: total internal reflection.",
  },
  "lesson-C7": {
    en: "A convex lens bends light from every point of an object so the rays meet again on the other side. Where they meet, a real image forms, whether or not a screen is there. Every part of the lens helps make every part of the image, so covering half of it only makes the image dimmer.",
    mr: "Convex lens वस्तूच्या प्रत्येक बिंदूकडून येणारा प्रकाश वाकवतो, ज्यामुळे किरण पलीकडे पुन्हा एकत्र येतात. जिथे ते एकत्र येतात, तिथे real image तयार होते, screen असो वा नसो. Lens चा प्रत्येक भाग image च्या प्रत्येक भागाला मदत करतो, म्हणून lens चा अर्धा भाग झाकला तरी image फक्त अंधुक होते.",
  },
  "result-SCIENTIFIC": {
    en: "That's right, and your reason holds up.",
    mr: "बरोबर! आणि तुमचं कारणही योग्य आहे.",
  },
  "result-FRAGILE": {
    en: "Right, even though you weren't sure.",
    mr: "बरोबर, जरी तुम्हाला खात्री नव्हती तरी.",
  },
  "result-PARTIAL": {
    en: "Right answer. Now tell the tutor why.",
    mr: "उत्तर बरोबर आहे. आता का ते सांगा.",
  },
  "result-FALSE_POSITIVE": {
    en: "Right answer, but the reason is a common wrong idea.",
    mr: "उत्तर बरोबर आहे, पण कारण हा एक सामान्य चुकीचा समज आहे.",
  },
  "result-MISCONCEPTION": {
    en: "Not quite: this is a common wrong idea.",
    mr: "अगदी तसं नाही: हा एक सामान्य चुकीचा समज आहे.",
  },
  "result-LACK_OF_KNOWLEDGE": {
    en: "Not there yet. Let's look at it another way.",
    mr: "अजून नाही. चला, हे वेगळ्या पद्धतीने पाहू.",
  },
  "result-SLIP": {
    en: "Your reasoning was right; the answer slipped.",
    mr: "तुमचा विचार बरोबर होता; उत्तरात थोडी चूक झाली.",
  },
  "result-COMPUTATIONAL_SLIP": {
    en: "Right method, small slip in the working.",
    mr: "पद्धत बरोबर, आकडेमोडीत छोटी चूक.",
  },
  "result-AMBIGUOUS": {
    en: "The tutor needs one more detail.",
    mr: "ट्यूटरला अजून एक माहिती हवी आहे.",
  },
  "result-UNDIAGNOSED": {
    en: "The tutor couldn't tell, so this one doesn't count.",
    mr: "ट्यूटरला नक्की सांगता आलं नाही, म्हणून हे उत्तर मोजलं जाणार नाही.",
  },
  "result-OFF_TOPIC": {
    en: "Let's stay with the question.",
    mr: "चला, प्रश्नाकडे परत येऊ.",
  },
} as const;
