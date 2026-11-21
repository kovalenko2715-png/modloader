import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import '../store.dart';
import '../models.dart';
import 'detail.dart';
import 'teach.dart';

class FeedScreen extends StatefulWidget {
  const FeedScreen({super.key, required this.site, required this.kernel});
  final Site site;
  final Kernel kernel;

  @override
  State<FeedScreen> createState() => _FeedScreenState();
}

class _FeedScreenState extends State<FeedScreen> {
  late final WebViewController ctl;
  final items = <VItem>[];
  final seenLinks = <String>{};
  Map<String, dynamic>? last;
  bool busy = true, eof = false, failed = false;

  @override
  void initState() {
    super.initState();
    ctl = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setUserAgent(
          'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36')
      ..setNavigationDelegate(NavigationDelegate(
        onPageFinished: (_) => _onLoaded(),
      ));
    ctl.loadRequest(Uri.parse(widget.site.url));
  }

  Future<void> _onLoaded() async {
    setState(() => busy = true);
    await Future.delayed(const Duration(milliseconds: 700));
    final r = await Kernel.runScript(ctl, widget.kernel.extract, {'mode': 'home'});
    _apply(r);
  }

  void _apply(dynamic r) {
    if (r is! Map) {
      setState(() {
        busy = false;
        failed = items.isEmpty;
      });
      return;
    }
    final m = Map<String, dynamic>.from(r);
    final list = m['items'];
    if (list is List) {
      for (final it in list) {
        if (it is! Map) continue;
        final item = VItem.fromJson(Map<String, dynamic>.from(it));
        if (item.link.isEmpty || seenLinks.contains(item.link)) continue;
        seenLinks.add(item.link);
        items.add(item);
      }
    }
    setState(() {
      last = m;
      busy = false;
      failed = items.isEmpty;
    });
  }

  Future<void> _loadMore() async {
    if (busy || eof || last == null) return;
    setState(() => busy = true);
    if (last!['more'] == true) {
      for (var i = 0; i < 5; i++) {
        await ctl.runJavaScript(
            'window.scrollTo(0, document.body.scrollHeight)');
        await Future.delayed(const Duration(milliseconds: 1200));
        final r = await Kernel.runScript(ctl, widget.kernel.extract, {'mode': 'more'});
        final before = items.length;
        _applySilent(r);
        if (items.length == before) break;
        if (mounted) setState(() => busy = false);
        return _loadMore();
      }
      if (mounted) setState(() { busy = false; eof = true; });
    } else {
      final next = (last!['next'] ?? '').toString();
      if (next.isEmpty || !next.startsWith('http')) {
        setState(() { busy = false; eof = true; });
      } else {
        await ctl.loadRequest(Uri.parse(next));
      }
    }
  }

  void _applySilent(dynamic r) {
    if (r is! Map) return;
    final m = Map<String, dynamic>.from(r);
    final list = m['items'];
    if (list is List) {
      for (final it in list) {
        if (it is! Map) continue;
        final item = VItem.fromJson(Map<String, dynamic>.from(it));
        if (item.link.isEmpty || seenLinks.contains(item.link)) continue;
        seenLinks.add(item.link);
        items.add(item);
      }
    }
    last = m;
  }

  Future<void> _search(String q) async {
    if (q.trim().isEmpty) return;
    String? url;
    final s = last?['search'];
    if (s is Map) {
      final action = (s['action'] ?? '').toString();
      if (action.startsWith('http')) {
        final uri = Uri.parse(action);
        final qp = Map<String, String>.from(uri.queryParameters);
        qp[(s['param'] ?? 's').toString()] = q.trim();
        if (s['extra'] is Map) {
          (s['extra'] as Map).forEach((k, v) => qp[k.toString()] = v.toString());
        }
        url = uri.replace(queryParameters: qp).toString();
      }
    }
    if (url == null) {
      final b = widget.site.url;
      url = b.contains('?') ? '$b&s=${Uri.encodeComponent(q)}' : '$b?s=${Uri.encodeComponent(q)}';
    }
    setState(() { busy = true; items.clear(); seenLinks.clear(); });
    await ctl.loadRequest(Uri.parse(url));
  }

  void _open(VItem it) {
    Store.I.pushHistory(HistEntry(
        siteId: widget.site.id, siteName: widget.site.name,
        title: it.title, link: it.link, thumb: it.thumb,
        ts: DateTime.now().millisecondsSinceEpoch));
    Navigator.of(context).push(MaterialPageRoute(
        builder: (_) => DetailScreen(
            site: widget.site, url: it.link, kernel: widget.kernel)));
  }

  Future<void> _teach() async {
    await Navigator.of(context).push(MaterialPageRoute(
        builder: (_) => TeachScreen(site: widget.site, kernel: widget.kernel)));
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Правило сохранено')));
  }

  @override
  Widget build(BuildContext context) {
    final ink = Theme.of(context).colorScheme.onSurface;
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.site.name, style: const TextStyle(fontSize: 18)),
        actions: [
          IconButton(icon: const Icon(Icons.search), onPressed: () async {
            final c = TextEditingController();
            final q = await showDialog<String>(context: context, builder: (ctx) => AlertDialog(
              backgroundColor: Theme.of(ctx).cardColor,
              title: const Text('Поиск по сайту'),
              content: TextField(controller: c, autofocus: true,
                  decoration: const InputDecoration(hintText: 'запрос…')),
              actions: [
                TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Отмена')),
                FilledButton(onPressed: () => Navigator.pop(ctx, c.text), child: const Text('Найти')),
              ],
            ));
            if (q != null) _search(q);
          }),
          IconButton(icon: const Icon(Icons.school_outlined), tooltip: 'Обучить парсер',
              onPressed: _teach),
        ],
      ),
      body: NotificationListener<ScrollNotification>(
        onNotification: (n) {
          if (n.metrics.pixels > n.metrics.maxScrollExtent - 600) _loadMore();
          return false;
        },
        child: Stack(children: [
          Positioned.fill(
            child: IgnorePointer(
              ignoring: true,
              child: Opacity(opacity: 0.01, child: WebViewWidget(controller: ctl)),
            ),
          ),
          if (failed)
            Center(
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  const Icon(Icons.videocam_off_outlined, size: 48, color: Colors.white24),
                  const SizedBox(height: 12),
                  const Text('Не смогли распознать этот сайт',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 16, color: Colors.white70)),
                  const SizedBox(height: 8),
                  const Text('Возможно, есть капча. Открой режим «Обучить парсер» — увидишь страницу живьём и сможешь указать карточки.',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 13, color: Colors.white38)),
                  const SizedBox(height: 16),
                  FilledButton(onPressed: _teach, child: const Text('Обучить парсер')),
                ]),
              ),
            )
          else
            GridView.builder(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 24),
              gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                  maxCrossAxisExtent: 260, mainAxisExtent: 210,
                  crossAxisSpacing: 10, mainAxisSpacing: 10),
              itemCount: items.length + (busy || eof ? 1 : 0),
              itemBuilder: (ctx, i) {
                if (i >= items.length) {
                  return Center(child: eof || !busy
                      ? const Text('Ничего больше нет', style: TextStyle(color: Colors.white24))
                      : const CircularProgressIndicator(strokeWidth: 2));
                }
                final it = items[i];
                return InkWell(
                  borderRadius: BorderRadius.circular(14),
                  onTap: () => _open(it),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Expanded(
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(14),
                        child: Stack(fit: StackFit.expand, children: [
                          Container(color: Theme.of(context).cardColor),
                          if (it.thumb.startsWith('http'))
                            Image.network(it.thumb, fit: BoxFit.cover,
                                loadingBuilder: (_, w, p) => p?.expectedTotalBytes != null
                                    ? const Center(child: SizedBox(width: 22, height: 22,
                                        child: CircularProgressIndicator(strokeWidth: 2)))
                                    : w,
                                errorBuilder: (_, __, ___) =>
                                    const Center(child: Icon(Icons.image_not_supported_outlined, color: Colors.white24))),
                          if (it.dur.isNotEmpty)
                            Positioned(right: 6, bottom: 6, child: _badge(it.dur, Colors.black87)),
                        ]),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(it.title, maxLines: 2, overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: 13, height: 1.25, color: ink)),
                  ]),
                );
              },
            ),
        ]),
      ),
    );
  }

  Widget _badge(String t, Color bg) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        decoration: BoxDecoration(color: bg.withValues(alpha: .85), borderRadius: BorderRadius.circular(6)),
        child: Text(t, style: const TextStyle(fontSize: 11, color: Colors.white)),
      );
}
