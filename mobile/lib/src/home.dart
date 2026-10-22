import 'package:flutter/material.dart';
import 'session.dart';
import 'profile.dart';
import 'petition_form.dart';
import 'petition_detail.dart';

class Home extends StatefulWidget {
  const Home({super.key, required this.session});
  final Session session;
  @override
  State<Home> createState() => _HomeState();
}
class _HomeState extends State<Home> {
  int _tab = 0;
  int _page = 1;
  bool _recommended = true;
  late Future<List<Map<String, dynamic>>> _feed;
  @override
  void initState() { super.initState(); _reload(); }
  void _reload() { _feed = widget.session.api.list('/api/bolsa/peticiones?recomendadas=$_recommended&propias=${_tab == 1}&pagina=$_page'); }
  Future<void> _refresh() async {
    setState(_reload);
    try { await _feed; } catch (_) { /* FutureBuilder presenta el error. */ }
  }
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('UniService'), actions: [IconButton(onPressed: widget.session.signOut, icon: const Icon(Icons.logout), tooltip: 'Cerrar sesión')]),
    body: _tab == 2 ? Profile(session: widget.session) : Column(children: [
      Padding(padding: const EdgeInsets.fromLTRB(20, 16, 20, 12), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(_tab == 1 ? 'Lo que necesitas' : 'Tu talento hace falta', style: Theme.of(context).textTheme.headlineMedium),
        const SizedBox(height: 8),
        Text(_tab == 1 ? 'Gestiona tus solicitudes y elige a quien te ayudará.' : 'Solicitudes de estudiantes que buscan habilidades como las tuyas.'),
        if (_tab == 0) SwitchListTile(contentPadding: EdgeInsets.zero, title: const Text('Relacionadas con mis habilidades'), value: _recommended,
          onChanged: (value) => setState(() { _recommended = value; _page = 1; _reload(); })),
      ])),
      Expanded(child: FutureBuilder<List<Map<String, dynamic>>>(future: _feed, builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
        if (snapshot.hasError) return Center(child: Padding(padding: const EdgeInsets.all(24), child: Column(mainAxisSize: MainAxisSize.min, children: [
          Text('No se pudieron cargar las solicitudes.\n${snapshot.error}'), TextButton(onPressed: _refresh, child: const Text('Reintentar')),
        ])));
        final items = snapshot.data!;
        return RefreshIndicator(onRefresh: _refresh, child: ListView(padding: const EdgeInsets.symmetric(horizontal: 16), physics: const AlwaysScrollableScrollPhysics(), children: [
          if (items.isEmpty) Padding(padding: const EdgeInsets.all(24), child: Text(_tab == 1 ? 'Aún no has publicado solicitudes.' : 'No hay solicitudes en esta página. Agrega habilidades en tu perfil o explora todas las solicitudes.')),
          ...items.map((item) => Card(child: ListTile(contentPadding: const EdgeInsets.all(16), title: Text(item['titulo'] as String),
            subtitle: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const SizedBox(height: 8), Text(item['descripcion'] as String, maxLines: 3, overflow: TextOverflow.ellipsis),
              const SizedBox(height: 8), Text('${item['autor']} · ${item['modalidad']} · ${item['estado']}'),
              Text(item['presupuesto'] == null ? 'Presupuesto a convenir' : 'COP ${item['presupuesto']}'),
              Wrap(spacing: 6, children: (item['habilidades'] as List).map((skill) => Chip(label: Text(skill.toString()))).toList()),
              if (item['ya_postulado'] == true) const Text('Ya te postulaste'),
            ]), trailing: const Icon(Icons.chevron_right), onTap: () async {
              await Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => PetitionDetail(session: widget.session, petition: item)));
              if (mounted) await _refresh();
            },
          ))),
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            TextButton(onPressed: _page > 1 ? () => setState(() { _page--; _reload(); }) : null, child: const Text('Anterior')),
            Text('Página $_page'),
            TextButton(onPressed: items.length == 20 ? () => setState(() { _page++; _reload(); }) : null, child: const Text('Siguiente')),
          ]), const SizedBox(height: 80),
        ]));
      })),
    ]),
    floatingActionButton: _tab == 2 ? null : FloatingActionButton.extended(onPressed: () async {
      final created = await Navigator.of(context).push<bool>(MaterialPageRoute(builder: (_) => PetitionForm(session: widget.session)));
      if (mounted && created == true) setState(() { _tab = 1; _page = 1; _reload(); });
    }, icon: const Icon(Icons.add), label: const Text('Pedir ayuda')),
    bottomNavigationBar: NavigationBar(selectedIndex: _tab, onDestinationSelected: (value) => setState(() { _tab = value; _page = 1; _reload(); }), destinations: const [
      NavigationDestination(icon: Icon(Icons.explore_outlined), label: 'Para ti'),
      NavigationDestination(icon: Icon(Icons.assignment_outlined), label: 'Mis solicitudes'),
      NavigationDestination(icon: Icon(Icons.person_outline), label: 'Mi perfil'),
    ]),
  );
}
