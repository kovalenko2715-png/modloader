class Site {
  Site({required this.id, required this.name, required this.url, this.rule});
  final String id;
  String name;
  String url;
  String? rule;

  factory Site.fromJson(Map<String, dynamic> j) => Site(
      id: j['id'] as String,
      name: j['name'] as String,
      url: j['url'] as String,
      rule: j['rule'] as String?);
  Map<String, dynamic> toJson() =>
      {'id': id, 'name': name, 'url': url, 'rule': rule};
}

class VItem {
  VItem({this.title = '', this.link = '', this.thumb = '',
      this.dur = '', this.kind = 'video', this.preview = '', this.date = ''});
  final String title, link, thumb, dur, kind, preview, date;

  factory VItem.fromJson(Map<String, dynamic> j) => VItem(
    title: (j['title'] ?? '').toString(),
    link: (j['link'] ?? '').toString(),
    thumb: (j['thumb'] ?? '').toString(),
    dur: (j['dur'] ?? '').toString(),
    kind: (j['kind'] ?? 'video').toString(),
    preview: (j['preview'] ?? '').toString(),
    date: (j['date'] ?? '').toString(),
  );
}

class HistEntry {
  HistEntry({required this.siteId, required this.siteName, required this.title,
      required this.link, required this.thumb, required this.ts});
  final String siteId, siteName, title, link, thumb;
  final int ts;

  factory HistEntry.fromJson(Map<String, dynamic> j) => HistEntry(
    siteId: j['siteId'] as String, siteName: j['siteName'] as String,
    title: j['title'] as String, link: j['link'] as String,
    thumb: j['thumb'] as String, ts: j['ts'] as int);
  Map<String, dynamic> toJson() => {'siteId': siteId, 'siteName': siteName,
    'title': title, 'link': link, 'thumb': thumb, 'ts': ts};
}
