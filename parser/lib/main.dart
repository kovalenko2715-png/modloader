import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'store.dart';
import 'screens/home.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Store.init();
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    systemNavigationBarColor: Color(0xFF0A0D12),
  ));
  runApp(const VideoPlusApp());
}

class VideoPlusApp extends StatefulWidget {
  const VideoPlusApp({super.key, this.initialAmoled = true});
  final bool initialAmoled;
  @override
  State<VideoPlusApp> createState() => _VideoPlusAppState();
}

class _VideoPlusAppState extends State<VideoPlusApp> {
  @override
  Widget build(BuildContext context) {
    final amoled = Store.I.amoled;
    final bg = amoled ? const Color(0xFF000000) : const Color(0xFF0A0D12);
    final panel = amoled ? const Color(0xFF0C0F14) : const Color(0xFF12161D);
    return MaterialApp(
      title: 'VideoPlus',
      debugShowCheckedModeBanner: false,
      themeMode: ThemeMode.dark,
      theme: ThemeData(
        useMaterial3: true,
        brightness: Brightness.dark,
        scaffoldBackgroundColor: bg,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF7C5CFF),
          brightness: Brightness.dark,
          surface: panel,
        ),
        cardColor: panel,
        appBarTheme: AppBarTheme(backgroundColor: bg, foregroundColor: Colors.white),
        fontFamily: 'Roboto',
        pageTransitionsTheme: const PageTransitionsTheme(builders: {
          TargetPlatform.android: ZoomPageTransitionsBuilder(),
        }),
      ),
      home: const HomeScreen(),
    );
  }
}
