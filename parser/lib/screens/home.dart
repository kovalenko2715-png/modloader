import 'package:flutter/material.dart';
import '../store.dart';
import '../models.dart';
import 'feed.dart';
import 'detail.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  late List<Site> sites;
  late List<HistEntry> hist;
  Kernel? kernel;

  @override
  void initState() {
    super.initState();
    sites = Store.I.sites();
    hist = Store.I.history();
    Kernel.load().then((k) => setState(() => kernel = k));
  }

  void _refresh() => setState(() {
        sites = Store.I.sites();
        hist = Store.I.history();
      });

  Color _siteColor(String key) {
    var h = 0;
    for (final c in key.codeUnits) {
      h = (h * 31 + c) % 360;
    }
    return HSLColor.fromAHSL(1, h.toDouble(), .55, .5).toColor();
  }

  Future<void> _addSite() async {
    final ctl = TextEditingController();
    await showDialog(context: context, builder: (ctx) => AlertDialog(
      backgroundColor: Theme.of(ctx).cardColor,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      title: const Text('Новый сайт'),
      content: TextField(
        controller: ctl,
        keyboardType: TextInputType.url,
        decoration: const InputDecoration(
          hintText: 'example.com',
          border: OutlineInputBorder(),
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Отмена')),
        FilledButton(
          onPressed: () => Navigator.pop(ctx, ctl.text.trim()),
          child: const Text('Добавить'),
        ),
      ],
    ));
    var u = ctl.text.trim();
    if (u.isEmpty) return;
    if (!u.startsWith('http')) u = 'https://$u';
    final host = Uri.tryParse(u)?.host ?? '';
    if (host.isEmpty) return;
    if (sites.any((s) => Uri.parse(s.url).host == host)) return;
    setState(() {
      sites.add(Site(id: DateTime.now().millisecondsSinceEpoch.toString(), name: host, url: u));
      Store.I.saveSites(sites);
    });
  }

  void _openFeed(Site s) {
    if (kernel == null) return;
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => FeedScreen(site: s, kernel: kernel!),
    )).then((_) => _refresh());
  }

  void _openHist(HistEntry e) {
    if (kernel == null) return;
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => DetailScreen(
          site: Site(id: e.siteId, name: e.siteName, url: '' ),
          url: e.link,
          kernel: kernel!),
    )).then((_) => _refresh());
  }

  void _settings() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Theme.of(context).cardColor,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(builder: (ctx, setSheet) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          SwitchListTile(
            title: const Text('Черно-белая AMOLED тема'),
            value: Store.I.amoled,
            onChanged: (v) { setSheet(() => Store.I.amoled = v); },
          ),
          SwitchListTile(
            title: const Text('Инкогнито по умолчанию'),
            value: Store.I.incognito,
            onChanged: (v) { setSheet(() => Store.I.incognito = v); setState(() {}); },
          ),
          const SizedBox(height: 8),
          ListTile(
            leading: const Icon(Icons.delete_sweep_outlined, color: Color(0xFFE16F6F)),
            title: const Text('Очистить историю'),
            onTap: () { Store.I.clearHistory(); setState(() => hist = []); Navigator.pop(ctx); },
          ),
        ]),
      )),
    );
  }

  void _del(Site s) {
    setState(() {
      sites.removeWhere((x) => x.id == s.id);
      Store.I.saveSites(sites);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(child: _header()),
            if (hist.isNotEmpty) ...[
              const SliverToBoxAdapter(child: _SectionTitle('Продолжить')),
              SliverToBoxAdapter(child: SizedBox(height: 108, child: _histStrip())),
            ],
            const SliverToBoxAdapter(child: _SectionTitle('Сайты')),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
              sliver: SliverGrid(
                gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                    maxCrossAxisExtent: 320, mainAxisExtent: 84,
                    crossAxisSpacing: 12, mainAxisSpacing: 12),
                delegate: SliverChildBuilderDelegate(
                  (ctx, i) {
                    if (i == sites.length) return _addCard();
                    final s = sites[i];
                    return _siteCard(s);
                  },
                  childCount: sites.length + 1,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _header() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 12, 6),
      child: Row(children: [
        ShaderMask(
          shaderCallback: (b) => const LinearGradient(
                  colors: [Color(0xFF7C5CFF), Color(0xFF4FACFE)])
              .createShader(b),
          child: const Text('VideoPlus',
              style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: Colors.white)),
        ),
        const Spacer(),
        IconButton(
          onPressed: () => setState(() {
            Store.I.incognito = !Store.I.incognito;
          }),
          icon: Icon(Store.I.incognito ? Icons.visibility_off : Icons.visibility,
              color: Store.I.incognito ? const Color(0xFF7C5CFF) : Colors.white54),
          tooltip: 'Инкогнито',
        ),
        IconButton(
          onPressed: _settings,
          icon: const Icon(Icons.settings_outlined, color: Colors.white54),
          tooltip: 'Настройки',
        ),
      ]),
    );
  }

  Widget _histStrip() => ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: hist.length.clamp(0, 12),
        itemBuilder: (ctx, i) {
          final e = hist[i];
          return Padding(
            padding: const EdgeInsets.only(right: 10),
            child: GestureDetector(
              onTap: () => _openHist(e),
              child: SizedBox(
                width: 150,
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Expanded(
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: Stack(fit: StackFit.expand, children: [
                        e.thumb.startsWith('http')
                            ? Image.network(e.thumb, fit: BoxFit.cover,
                                errorBuilder: (_, __, ___) => Container(color: Theme.of(context).cardColor))
                            : Container(color: Theme.of(context).cardColor),
                        Positioned(right: 4, bottom: 4, child: _badge(e.siteName)),
                      ]),
                    ),
                  ),
                ]),
              ),
            ),
          );
        },
      );

  Widget _badge(String t) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        decoration: BoxDecoration(
            color: Colors.black54, borderRadius: BorderRadius.circular(6)),
        child: Text(t, style: const TextStyle(fontSize: 10, color: Colors.white)),
      );

  Widget _siteCard(Site s) {
    final ink = Theme.of(context).colorScheme.onSurface;
    return InkWell(
      borderRadius: BorderRadius.circular(16),
      onTap: () => _openFeed(s),
      onLongPress: () => _confirmDelete(s),
      child: Container(
        decoration: BoxDecoration(
          color: Theme.of(context).cardColor,
          borderRadius: BorderRadius.circular(16),
        ),
        padding: const EdgeInsets.all(14),
        child: Row(children: [
          Container(
            width: 46, height: 46, alignment: Alignment.center,
            decoration: BoxDecoration(
                color: _siteColor(s.name).withValues(alpha: .18),
                borderRadius: BorderRadius.circular(12)),
            child: Text(s.name.isNotEmpty ? s.name[0].toUpperCase() : '?',
                style: TextStyle(
                    fontSize: 20, fontWeight: FontWeight.w700, color: _siteColor(s.name))),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center, children: [
              Text(s.name, maxLines: 1, overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15, color: ink)),
              Text(s.url, maxLines: 1, overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 12, color: Colors.white38)),
            ]),
          ),
        ]),
      ),
    );
  }

  Widget _addCard() => InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: _addSite,
        child: Container(
          decoration: BoxDecoration(
            color: Theme.of(context).cardColor,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFF2A3340), width: 1.2),
          ),
          child: Center(child: Column(mainAxisSize: MainAxisSize.min, children: const [
            Icon(Icons.add, size: 30, color: Color(0xFF7C5CFF)),
            Text('Добавить сайт', style: TextStyle(fontSize: 13, color: Colors.white38)),
          ])),
        ),
      );

  void _confirmDelete(Site s) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Theme.of(ctx).cardColor,
        title: Text('Удалить ${s.name}?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Нет')),
          FilledButton(
            onPressed: () { Navigator.pop(ctx); _del(s); },
            style: FilledButton.styleFrom(backgroundColor: const Color(0xFFE16F6F)),
            child: const Text('Удалить'),
          ),
        ],
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.t);
  final String t;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 14, 16, 6),
        child: Text(t, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
      );
}
