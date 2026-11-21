import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import '../store.dart';
import '../models.dart';

class TeachScreen extends StatefulWidget {
  const TeachScreen({super.key, required this.site, required this.kernel});
  final Site site;
  final Kernel kernel;

  @override
  State<TeachScreen> createState() => _TeachScreenState();
}

class _TeachScreenState extends State<TeachScreen> {
  late final WebViewController ctl;
  bool injected = false;
  double progress = 0;

  @override
  void initState() {
    super.initState();
    ctl = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setUserAgent(
          'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36')
      ..setNavigationDelegate(NavigationDelegate(
        onProgress: (p) => setState(() => progress = p / 100.0),
        onPageFinished: (_) => _inject(),
      ));
    ctl.loadRequest(Uri.parse(widget.site.url));
  }

  Future<void> _inject() async {
    if (injected) return;
    injected = true;
    await Kernel.runScript(ctl, widget.kernel.teach, {});
    _poll();
  }

  Future<void> _poll() async {
    while (mounted) {
      await Future.delayed(const Duration(milliseconds: 700));
      try {
        final r = await ctl.runJavaScriptReturningResult(
            'window.__teach ? (window.__teach.sel || "") : ""');
        var s = r == null ? '' : r.toString();
        if (s.startsWith('"')) s = s.substring(1, s.length - 1);
        if (s.isNotEmpty) {
          _save(s);
          return;
        }
      } catch (_) {}
    }
  }

  void _save(String sel) {
    final sites = Store.I.sites();
    for (final s in sites) {
      if (s.id == widget.site.id) s.rule = sel;
    }
    Store.I.saveSites(sites);
    if (mounted) Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Обучение: нажми на карточку видео', style: TextStyle(fontSize: 15)),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(2),
          child: LinearProgressIndicator(value: progress == 0 ? null : progress, minHeight: 2),
        ),
      ),
      body: WebViewWidget(controller: ctl),
    );
  }
}
