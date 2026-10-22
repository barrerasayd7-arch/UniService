import 'package:flutter/material.dart';
import 'src/session.dart';
import 'src/home.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(UniServiceApp(session: Session()));
}

class UniServiceApp extends StatefulWidget {
  const UniServiceApp({super.key, required this.session});
  final Session session;
  @override
  State<UniServiceApp> createState() => _UniServiceAppState();
}

class _UniServiceAppState extends State<UniServiceApp> {
  @override
  void initState() {
    super.initState();
    widget.session.restore();
  }
  @override
  void dispose() {
    widget.session.dispose();
    super.dispose();
  }
  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: widget.session,
    builder: (context, _) => MaterialApp(
      title: 'UniService',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xff17634b)),
        scaffoldBackgroundColor: const Color(0xfff5f6f0),
        inputDecorationTheme: const InputDecorationTheme(border: OutlineInputBorder(), filled: true, fillColor: Colors.white),
      ),
      home: widget.session.restoring
          ? const Scaffold(body: Center(child: CircularProgressIndicator()))
          : widget.session.signedIn ? Home(session: widget.session) : LoginScreen(session: widget.session),
    ),
  );
}

class LoginScreen extends StatelessWidget {
  const LoginScreen({super.key, required this.session});
  final Session session;
  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(child: Center(child: SingleChildScrollView(
      padding: const EdgeInsets.all(28),
      child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 440), child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.school_outlined, size: 56, color: Color(0xff17634b)),
          const SizedBox(height: 24),
          Text('UniService', style: Theme.of(context).textTheme.displaySmall),
          const SizedBox(height: 12),
          Text('El talento de tu universidad,\na tu alcance.', style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 20),
          const Text('Comparte tus habilidades, encuentra solicitudes relacionadas y ayuda a otros estudiantes de la UPC.'),
          const SizedBox(height: 36),
          FilledButton.icon(
            onPressed: session.busy ? null : session.signIn,
            icon: session.busy ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.login),
            label: Text(session.busy ? 'Conectando…' : 'Continuar con Microsoft'),
          ),
          const SizedBox(height: 16),
          const Text('Usa tu correo @unicesar.edu.co. El acceso está reservado a estudiantes activos verificados por la universidad.'),
          if (session.error != null) ...[
            const SizedBox(height: 20),
            Text(session.error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
          ],
        ],
      )),
    ))),
  );
}
