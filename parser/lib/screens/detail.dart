import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';
import '../store.dart';
import '../models.dart';
import 'player_screen.dart';

class DetailScreen extends StatefulWidget {
  const DetailScreen({super.key, required this.site, required this.url, required this.kernel});
  final Site site;
  final String url;
  final Kernel kernel;

  @override
  State<DetailScreen> createState() => _DetailScreenState();
}

class _DetailScreenState extends State<DetailScreen> {
  late final WebViewController ctl;
  final found = <String>[];
  final episodes = <(String, String)>[]; // (title, url)
  String title = '';
  bool resolving = true, playing = false;
  int tries = 0;
  double progress = 0;

  @override
  void initState() {
    super.initState();
    ctl = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setUserAgent(
          'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36')
      ..setNavigationDelegate(NavigationDelegate(
        onProgress: (p) { if (mounted) setState(() => progress = p / 100.0); },
        onPageFinished: (_) => _resolve(),
      ));
    ctl.loadRequest(Uri.parse(widget.url));
  }

  Future<void> _resolve() async {
    await Future.delayed(const Duration(milliseconds: 800));
    for (var t = 0; t < 3; t++) {
      final sn = await Kernel.runScript(ctl, widget.kernel.sniff, {});
      final de = await Kernel.runScript(ctl, widget.kernel.detail, {});
      _collect(sn);
      _collect(de);
      _collectEpisodes(de);
      if (found.isNotEmpty) break;
      await Future.delayed(const Duration(milliseconds: 2500));
    }
    if (!mounted) return;
    setState(() { resolving = false; });
    if (title.isEmpty && widget.url.isNotEmpty) {
      setState(() => title = widget.site.name);
    }
  }

  void _collect(dynamic r) {
    if (r is! Map) return;
    if ((r['title'] ?? '').toString().isNotEmpty) title = r['title'].toString();
    final urls = r['urls'];
    if (urls is List) {
      for (final u in urls) {
        final s = u.toString();
        if (s.startsWith('http') &&
            RegExp(r'\.(mp4|webm|mkv|mov|m4v)(\?|#|$)', caseSensitive: false).hasMatch(s) &&
            !RegExp(r'(seg|segment|chunk|frag|fragment|init)[-_]?\d*\.(mp4|m4s)$', caseSensitive: false).hasMatch(s) &&
            !found.contains(s)) {
          found.add(s);
        }
      }
    }
  }

  void _collectEpisodes(dynamic r) {
    if (r is! Map) return;
    final eps = r['episodes'];
    if (eps is! List) return;
    for (final e in eps) {
      if (e is! Map) continue;
      final t = (e['title'] ?? '').toString();
      final u = (e['url'] ?? e['link'] ?? '').toString();
      if (u.startsWith('http')) episodes.add((t, u));
    }
  }

  void _play() async {
    if (found.isEmpty) return;
    if (!Store.I.incognito) {
      Store.I.pushHistory(HistEntry(
          siteId: widget.site.id, siteName: widget.site.name,
          title: title.isEmpty ? widget.url : title,
          link: widget.url, thumb: '', ts: DateTime.now().millisecondsSinceEpoch));
    }
    await Navigator.of(context).push(MaterialPageRoute(
        builder: (_) => PlayerScreen(url: found.first, title: title)));
    if (mounted) setState(() => playing = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(title.isEmpty ? 'Открываю…' : (title.length > 40 ? '${title.substring(0, 40)}…' : title),
            style: const TextStyle(fontSize: 15)),
        bottom: resolving
            ? PreferredSize(preferredSize: const Size.fromHeight(2), child: LinearProgressIndicator(value: progress == 0 ? null : progress, minHeight: 2))
            : null,
      ),
      body: Column(children: [
        if (!resolving)
          _panel(),
        Expanded(child: WebViewWidget(controller: ctl)),
      ]),
    );
  }

  Widget _panel() {
    return Container(
      width: double.infinity,
      color: Theme.of(context).cardColor,
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        if (found.isEmpty)
          Row(children: [
            const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)),
            const SizedBox(width: 10),
            Expanded(child: Text(
              tries < 5 ? 'Ищу прямую ссылку на видео…' : 'Видео не найдено. Если на странице капча — пройди её прямо в окне ниже и нажми ещё раз.',
              style: const TextStyle(fontSize: 13, color: Colors.white54))),
            TextButton(onPressed: () { setState(() { resolving = true; tries = 0; }); _resolve(); },
                child: const Text('Ещё раз')),
          ])
        else ...[
          Row(children: [
            Expanded(child: Text('Найдено видео: ${found.length}',
                style: const TextStyle(fontSize: 13, color: Colors.white54))),
            FilledButton.icon(
              onPressed: found.isEmpty || playing ? null : () { setState(() => playing = true); _play(); },
              icon: const Icon(Icons.play_arrow),
              label: const Text('Смотреть'),
            ),
            const SizedBox(width: 8),
            IconButton(
              onPressed: () => launchUrl(Uri.parse(found.first), mode: LaunchMode.externalApplication),
              icon: const Icon(Icons.open_in_new),
              tooltip: 'Внешний плеер',
            ),
          ]),
          if (episodes.isNotEmpty) ...[
            const SizedBox(height: 6),
            SizedBox(
              height: 38,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: episodes.length.clamp(0, 60),
                separatorBuilder: (_, __) => const SizedBox(width: 6),
                itemBuilder: (ctx, i) {
                  final e = episodes[i];
                  return ActionChip(
                    label: Text(e.$1.isEmpty ? '${i + 1}' : e.$1, style: const TextStyle(fontSize: 12)),
                    backgroundColor: const Color(0xFF20293A),
                    onPressed: () {
                      found.clear();
                      setState(() => resolving = true);
                      ctl.loadRequest(Uri.parse(e.$2));
                    },
                  );
                },
              ),
            ),
          ],
        ],
      ]),
    );
  }
}
