import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { 
  Volume2, 
  VolumeX, 
  RotateCcw, 
  CheckCircle2, 
  XCircle, 
  MinusCircle, 
  X,
  Radio,
  Users,
  Zap,
  Sliders,
  Edit2,
  Check,
  Target,
  Droplet,
  Fuel,
  TrendingUp,
  BarChart2,
  Coins
} from 'lucide-react';

interface Operacao {
  id: string;
  t: number;
  tipo: 'WIN' | 'LOSS' | 'EMPATE';
  valorEntrada: number;
  valor: number; // Lucro ou prejuízo líquido resultante
  payout: number; // Ex: 0.90 (90%)
  par: string;
  dir: 'CALL' | 'PUT';
  horario: string;
}

interface TemplateOp {
  t: number;
  tipo: 'WIN' | 'LOSS' | 'EMPATE';
  payout: number; // Payout do ativo de petróleo (ex: 90%)
  par: string;
  dir: 'CALL' | 'PUT';
}

// 9 Operações de Petróleo (6 Wins, 2 Losses, 1 Empate)
const TEMPLATE_OPERACOES: TemplateOp[] = [
  { t: 2000, tipo: 'WIN', payout: 0.90, par: 'PETRA (Petróleo)', dir: 'CALL' },
  { t: 5200, tipo: 'WIN', payout: 0.92, par: 'BRENT CRUDE (Petróleo Cru)', dir: 'PUT' },
  { t: 8400, tipo: 'LOSS', payout: 1.00, par: 'PETRA (Petróleo)', dir: 'CALL' },
  { t: 11800, tipo: 'WIN', payout: 0.89, par: 'WTI OIL (Petróleo Leve)', dir: 'CALL' },
  { t: 15200, tipo: 'EMPATE', payout: 0.00, par: 'PETRA DIESEL (Refinado)', dir: 'PUT' },
  { t: 18600, tipo: 'WIN', payout: 0.91, par: 'PETRA (Petróleo)', dir: 'CALL' },
  { t: 22000, tipo: 'LOSS', payout: 1.00, par: 'BRENT CRUDE (Petróleo Cru)', dir: 'PUT' },
  { t: 25400, tipo: 'WIN', payout: 0.90, par: 'PETRA (Petróleo)', dir: 'CALL' },
  { t: 28400, tipo: 'WIN', payout: 0.93, par: 'GASÓLEO / PETRA OTC', dir: 'PUT' }
];

const NOMES_PROVA_SOCIAL = [
  'Beatriz M.', 
  'Marcos S.', 
  'Camila R.', 
  'Lucas F.', 
  'Felipe D.', 
  'Juliana P.', 
  'Rafael G.',
  'Gabriel O.',
  'Larissa K.',
  'Thiago B.'
];

class SoundFX {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;

  private init() {
    if (!this.ctx && typeof window !== 'undefined' && window.AudioContext) {
      this.ctx = new window.AudioContext();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  play(freq: number, type: OscillatorType, duration: number, gainVal = 0.1) {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      g.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch {
      // Audio fallback
    }
  }

  win() {
    this.play(523, 'sine', 0.18, 0.15);
    setTimeout(() => this.play(659, 'sine', 0.22, 0.15), 75);
    setTimeout(() => this.play(783, 'sine', 0.3, 0.15), 150);
  }

  loss() {
    this.play(310, 'sawtooth', 0.28, 0.12);
  }

  tie() {
    this.play(440, 'sine', 0.15, 0.1);
  }

  celebration() {
    [523, 659, 783, 1046].forEach((f, i) => {
      setTimeout(() => this.play(f, 'triangle', 0.35, 0.15), i * 85);
    });
  }
}

const sfx = new SoundFX();

export default function App() {
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);
  
  // Bankroll & Profit States
  const [saldo, setSaldo] = useState<number>(200.00);
  const [lucro, setLucro] = useState<number>(0.00);
  const [displaySaldo, setDisplaySaldo] = useState<number>(200.00);
  const [displayLucro, setDisplayLucro] = useState<number>(0.00);
  
  // ENTRADA POR OPERAÇÃO (Definido pelo usuário)
  const [valorEntrada, setValorEntrada] = useState<number>(50.00);
  const [metaLucroValor, setMetaLucroValor] = useState<number>(200.00);

  // Counters
  const [winCount, setWinCount] = useState<number>(0);
  const [lossCount, setLossCount] = useState<number>(0);
  const [tieCount, setTieCount] = useState<number>(0);

  // Execution states
  const [emExecucao, setEmExecucao] = useState<boolean>(false);
  const [segundosRestantes, setSegundosRestantes] = useState<number>(30);
  const [statusTexto, setStatusTexto] = useState<string>('Aguardando ativação dos poços de petróleo...');
  
  // Floating delta badge
  const [deltaBadge, setDeltaBadge] = useState<{ valor: number; tipo: 'WIN' | 'LOSS' | 'EMPATE' } | null>(null);
  const [contabilizando, setContabilizando] = useState<boolean>(false);

  // Popup modal state
  const [popupData, setPopupData] = useState<{
    op: Operacao;
    index: number;
    total: number;
    novoSaldo: number;
  } | null>(null);
  const [popupBarWidth, setPopupBarWidth] = useState<number>(100);

  // History of operations
  const [historico, setHistorico] = useState<Operacao[]>([]);

  // Chart state (PETRA de petróleo)
  const [bars, setBars] = useState<number[]>([
    68, 52, 58, 42, 64, 59, 30, 78, 45, 88, 82, 38, 65, 24, 48, 92, 54, 34, 74, 20, 28, 66, 40, 48, 80, 85, 32, 68
  ]);
  const [precoAtivo, setPrecoAtivo] = useState<string>('R$ 38,45 ↗');
  const [precoBarrilUSD, setPrecoBarrilUSD] = useState<string>('US$ 78.60');

  // Social Proof & Online Counter
  const [notificacaoLucro, setNotificacaoLucro] = useState<string>('Beatriz M. acabou de lucrar R$167,44 em PETRA!');
  const [onlineCounter, setOnlineCounter] = useState<number>(4241);

  // Modals & Editable Inputs
  const [showResetModal, setShowResetModal] = useState<boolean>(false);
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  
  // Editable text inputs
  const [inputSaldoTexto, setInputSaldoTexto] = useState<string>('200,00');
  const [inputEntradaTexto, setInputEntradaTexto] = useState<string>('50,00');
  const [inputMetaTexto, setInputMetaTexto] = useState<string>('200,00');
  
  // Inline balance editing
  const [isEditingInline, setIsEditingInline] = useState<boolean>(false);
  const [inlineSaldoInput, setInlineSaldoInput] = useState<string>('200,00');

  // Inline entry editing
  const [isEditingEntradaInline, setIsEditingEntradaInline] = useState<boolean>(false);
  const [inlineEntradaInput, setInlineEntradaInput] = useState<string>('50,00');

  // References for timers and animations
  const timeoutsRef = useRef<NodeJS.Timeout[]>([]);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const popupIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const formatoBRL = (v: number) => {
    return 'R$ ' + Math.abs(v).toFixed(2).replace('.', ',');
  };

  const parseMoeda = (valStr: string): number => {
    const limpo = valStr.replace(/[^\d.,]/g, '').replace(',', '.');
    const parsed = parseFloat(limpo);
    return isNaN(parsed) || parsed < 0 ? 0 : parsed;
  };

  // Sync audio toggle with sound fx
  const toggleAudio = () => {
    const nextState = !audioEnabled;
    sfx.enabled = nextState;
    setAudioEnabled(nextState);
  };

  // Smooth balance roll animation
  const animarSaldo = (targetSaldo: number, targetLucro: number, deltaVal: number, tipo: 'WIN' | 'LOSS' | 'EMPATE') => {
    if (deltaVal > 0) {
      setDeltaBadge({ valor: deltaVal, tipo });
      setContabilizando(true);
    }

    const startSaldo = displaySaldo;
    const startLucro = displayLucro;
    const startTime = performance.now();
    const duration = 1200;

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const ease = 1 - Math.pow(1 - progress, 3);

      const curSaldo = startSaldo + (targetSaldo - startSaldo) * ease;
      const curLucro = startLucro + (targetLucro - startLucro) * ease;

      setDisplaySaldo(curSaldo);
      setDisplayLucro(curLucro);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(step);
      } else {
        setDisplaySaldo(targetSaldo);
        setDisplayLucro(targetLucro);
        setTimeout(() => {
          setDeltaBadge(null);
          setContabilizando(false);
        }, 1100);
      }
    };

    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(step);
  };

  // Execute single trade
  const executarOperacao = (
    opTemplate: { tipo: 'WIN' | 'LOSS' | 'EMPATE'; valorEntrada: number; valor: number; payout: number; par: string; dir: 'CALL' | 'PUT' }, 
    index: number, 
    total: number, 
    currentSaldo: number, 
    currentLucro: number
  ) => {
    const now = new Date();
    const horario = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const op: Operacao = {
      ...opTemplate,
      id: Math.random().toString(36).substring(2, 9),
      horario,
      t: 0
    };

    let nextSaldo = currentSaldo;
    let nextLucro = currentLucro;

    if (op.tipo === 'WIN') {
      nextSaldo = currentSaldo + op.valor;
      nextLucro = currentLucro + op.valor;
      setWinCount(prev => prev + 1);
      sfx.win();
      animarBarras(true);
    } else if (op.tipo === 'LOSS') {
      nextSaldo = Math.max(0, currentSaldo - op.valor);
      nextLucro = currentLucro - op.valor;
      setLossCount(prev => prev + 1);
      sfx.loss();
      animarBarras(false);
    } else {
      setTieCount(prev => prev + 1);
      sfx.tie();
    }

    setSaldo(nextSaldo);
    setLucro(nextLucro);
    animarSaldo(nextSaldo, nextLucro, op.valor, op.tipo);
    setHistorico(prev => [op, ...prev]);

    // Show popup
    abrirPopup(op, index, total, nextSaldo);

    // Randomize ticker price for PETRA (Petróleo)
    const basePreco = 38.25 + Math.random() * 0.75;
    const baseUSD = 78.20 + Math.random() * 0.90;
    const direcaoSeta = op.tipo === 'WIN' ? '↗' : op.tipo === 'LOSS' ? '↘' : '→';
    setPrecoAtivo(`R$ ${basePreco.toFixed(2).replace('.', ',')} ${direcaoSeta}`);
    setPrecoBarrilUSD(`US$ ${baseUSD.toFixed(2)}`);
  };

  const animarBarras = (_isWin: boolean) => {
    setBars(prev => prev.map(() => Math.floor(Math.random() * 70) + 20));
  };

  const abrirPopup = (op: Operacao, index: number, total: number, novoSaldo: number) => {
    setPopupData({ op, index, total, novoSaldo });
    setPopupBarWidth(100);

    if (popupIntervalRef.current) clearInterval(popupIntervalRef.current);
    const start = Date.now();
    const dur = 2300;

    popupIntervalRef.current = setInterval(() => {
      const passed = Date.now() - start;
      const rest = Math.max(0, 100 - (passed / dur) * 100);
      setPopupBarWidth(rest);
      if (passed >= dur) {
        if (popupIntervalRef.current) clearInterval(popupIntervalRef.current);
        setPopupData(null);
      }
    }, 40);
  };

  const fecharPopup = () => {
    if (popupIntervalRef.current) clearInterval(popupIntervalRef.current);
    setPopupData(null);
  };

  // Start 30s automated session using defined Entrada por Operação
  const iniciarSessao30s = () => {
    if (emExecucao) return;
    setEmExecucao(true);
    setSegundosRestantes(30);
    setStatusTexto(`Ciclo de 30s ativo: entradas de ${formatoBRL(valorEntrada)} em Petróleo...`);
    sfx.play(440, 'triangle', 0.25);

    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    let sec = 30;
    countdownIntervalRef.current = setInterval(() => {
      sec--;
      setSegundosRestantes(sec);
      if (sec <= 0) {
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        finalizarSessao();
      }
    }, 1000);

    let runningSaldo = saldo;
    let runningLucro = lucro;

    // Gerar as operações baseadas no Valor da Entrada por Operação definido pelo usuário
    TEMPLATE_OPERACOES.forEach((template, idx) => {
      let valorResultado = 0;
      if (template.tipo === 'WIN') {
        // Lucro líquido no WIN = Entrada * Payout (ex: 90%)
        valorResultado = Number((valorEntrada * template.payout).toFixed(2));
      } else if (template.tipo === 'LOSS') {
        // Prejuízo no LOSS = Valor total investido na entrada
        valorResultado = Number(valorEntrada.toFixed(2));
      } else {
        // Empate = 0 (Entrada devolvida)
        valorResultado = 0.00;
      }

      const opItem = {
        tipo: template.tipo,
        valorEntrada: valorEntrada,
        valor: valorResultado,
        payout: template.payout,
        par: template.par,
        dir: template.dir
      };

      const tId = setTimeout(() => {
        executarOperacao(opItem, idx + 1, TEMPLATE_OPERACOES.length, runningSaldo, runningLucro);
        if (opItem.tipo === 'WIN') {
          runningSaldo += opItem.valor;
          runningLucro += opItem.valor;
        } else if (opItem.tipo === 'LOSS') {
          runningSaldo = Math.max(0, runningSaldo - opItem.valor);
          runningLucro -= opItem.valor;
        }
      }, template.t);
      timeoutsRef.current.push(tId);
    });
  };

  const finalizarSessao = () => {
    setEmExecucao(false);
    setStatusTexto(`Sessão finalizada com sucesso! 6 Wins, 2 Losses com entrada de ${formatoBRL(valorEntrada)}.`);
    sfx.celebration();
    try {
      confetti({
        particleCount: 85,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch {
      // Confetti fallback
    }
  };

  const reiniciarSessao = () => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    if (popupIntervalRef.current) clearInterval(popupIntervalRef.current);

    const novoSaldo = parseMoeda(inputSaldoTexto) || 200.00;
    setEmExecucao(false);
    setSaldo(novoSaldo);
    setLucro(0);
    setDisplaySaldo(novoSaldo);
    setDisplayLucro(0);
    setWinCount(0);
    setLossCount(0);
    setTieCount(0);
    setSegundosRestantes(30);
    setStatusTexto('Aguardando ativação dos poços de petróleo...');
    setDeltaBadge(null);
    setContabilizando(false);
    setPopupData(null);
    setHistorico([]);
    setShowResetModal(false);
  };

  const limparHistorico = () => {
    setHistorico([]);
  };

  const abrirModalConfig = () => {
    setInputSaldoTexto(saldo.toFixed(2).replace('.', ','));
    setInputEntradaTexto(valorEntrada.toFixed(2).replace('.', ','));
    setInputMetaTexto(metaLucroValor.toFixed(2).replace('.', ','));
    setShowConfigModal(true);
  };

  const salvarConfiguracao = () => {
    const valorDigitado = parseMoeda(inputSaldoTexto);
    const entradaDigitada = parseMoeda(inputEntradaTexto);
    const metaDigitada = parseMoeda(inputMetaTexto);

    if (valorDigitado > 0) {
      setSaldo(valorDigitado);
      setDisplaySaldo(valorDigitado);
    }
    if (entradaDigitada > 0) {
      setValorEntrada(entradaDigitada);
    }
    if (metaDigitada > 0) {
      setMetaLucroValor(metaDigitada);
    }

    setShowConfigModal(false);
  };

  // Salvar edição rápida de entrada na tela principal
  const salvarEdicaoEntradaInline = () => {
    const valorDigitado = parseMoeda(inlineEntradaInput);
    if (valorDigitado > 0) {
      setValorEntrada(valorDigitado);
      setInputEntradaTexto(valorDigitado.toFixed(2).replace('.', ','));
      // Ajusta meta sugerida automaticamente para ~3.5x a entrada
      setMetaLucroValor(Number((valorDigitado * 3.5).toFixed(2)));
    }
    setIsEditingEntradaInline(false);
  };

  const salvarEdicaoInline = () => {
    const valorDigitado = parseMoeda(inlineSaldoInput);
    if (valorDigitado > 0) {
      setSaldo(valorDigitado);
      setDisplaySaldo(valorDigitado);
      setInputSaldoTexto(valorDigitado.toFixed(2).replace('.', ','));
    }
    setIsEditingInline(false);
  };

  const cancelarEdicaoInline = () => {
    setInlineSaldoInput(saldo.toFixed(2).replace('.', ','));
    setIsEditingInline(false);
  };

  const definirEntradaRapida = (val: number) => {
    if (emExecucao) return;
    setValorEntrada(val);
    setInputEntradaTexto(val.toFixed(2).replace('.', ','));
    setMetaLucroValor(Number((val * 3.5).toFixed(2)));
  };

  // Social Proof and Live Counter ticker
  useEffect(() => {
    const interval = setInterval(() => {
      const nome = NOMES_PROVA_SOCIAL[Math.floor(Math.random() * NOMES_PROVA_SOCIAL.length)];
      // Proporcional ao valor de entrada definido pelo usuário
      const mult = (Math.random() * 0.9 + 0.9);
      const valor = (valorEntrada * mult).toFixed(2).replace('.', ',');
      setNotificacaoLucro(`${nome} acabou de lucrar R$${valor} em PETRA (Petróleo)!`);

      setOnlineCounter(prev => {
        const delta = Math.floor(Math.random() * 7) - 3;
        return Math.max(3800, prev + delta);
      });
    }, 4200);

    return () => clearInterval(interval);
  }, [valorEntrada]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(clearTimeout);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (popupIntervalRef.current) clearInterval(popupIntervalRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const metaPct = Math.min(100, Math.max(4, (lucro / metaLucroValor) * 100));

  return (
    <div className="min-h-screen bg-[#070a12] text-white flex justify-center items-center p-2 sm:p-4 selection:bg-amber-500 selection:text-black relative overflow-x-hidden">
      {/* Background ambient lighting - Petroleum Black Gold & Deep Blue Hues */}
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[580px] h-[400px] bg-amber-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 w-[420px] h-[260px] bg-cyan-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed top-1/2 -left-20 w-80 h-80 bg-amber-600/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Main Container Mobile Responsive Card - Petroleum Theme */}
      <main className="relative w-full max-w-[440px] bg-gradient-to-b from-[#0c1220] via-[#090d17] to-[#070a12] border border-[#252f48] rounded-3xl p-4 sm:p-5 shadow-2xl shadow-black/90 flex flex-col gap-3 z-10 backdrop-blur-xl">
        
        {/* Header com Elementos de Petróleo */}
        <header className="flex flex-col items-center justify-center pt-1 pb-0.5">
          <div className="w-full flex items-center justify-between px-1 mb-2">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest text-amber-300 bg-amber-950/60 border border-amber-700/50 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Fuel className="w-2.5 h-2.5 text-amber-400" />
                {emExecucao ? 'EXTRAÇÃO 30s ATIVA' : 'SISTEMA PETRÓLEO ATIVO'}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button 
                onClick={abrirModalConfig} 
                title="Configurar Banca, Entrada e Meta"
                className="flex items-center gap-1 p-1.5 px-2.5 rounded-xl text-amber-300 hover:text-white bg-[#161f36]/80 border border-amber-500/40 hover:bg-[#1f2b4a] transition-all text-xs font-semibold cursor-pointer shadow-sm shadow-amber-950/40"
              >
                <Sliders className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[10px] tracking-wide">Configurar</span>
              </button>
              <button 
                onClick={toggleAudio} 
                title={audioEnabled ? 'Desativar Sons' : 'Ativar Sons'}
                className="p-1.5 rounded-xl text-gray-300 hover:text-white bg-[#131a2b]/80 border border-slate-700/60 hover:bg-[#1a233a] transition-colors text-xs cursor-pointer"
              >
                {audioEnabled ? <Volume2 className="w-3.5 h-3.5 text-amber-400" /> : <VolumeX className="w-3.5 h-3.5 text-gray-500" />}
              </button>
              <button 
                onClick={() => setShowResetModal(true)} 
                title="Reiniciar Sessão"
                className="p-1.5 rounded-xl text-gray-300 hover:text-white bg-[#131a2b]/80 border border-slate-700/60 hover:bg-[#1a233a] transition-colors text-xs cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-300" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Ícone de Petróleo */}
            <div className="relative flex items-center justify-center w-9 h-9 rounded-2xl bg-gradient-to-br from-amber-500 via-yellow-600 to-amber-800 shadow-lg shadow-amber-900/60 border border-amber-300/40">
              <Droplet className="w-5 h-5 text-black fill-black" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-xl sm:text-2xl font-black tracking-wider text-white leading-none">
                IA SHARK<span className="text-amber-400">PETRO</span>
              </h1>
              <span className="text-[9px] uppercase tracking-widest text-amber-200/70 font-bold font-mono">
                ALGORITMO PETRÓLEO & COMMODITIES
              </span>
            </div>
          </div>
          
          <div className="inline-flex items-center gap-1.5 mt-1.5 px-3 py-0.5 rounded-full bg-amber-950/70 border border-amber-500/40 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
            <span className="text-xs font-bold text-amber-300 tracking-wide">
              Assertividade 99% em PETRA (Petróleo)
            </span>
          </div>
        </header>

        {/* CONTROLE DE ENTRADA POR OPERAÇÃO - DESIGN MINIMALISTA */}
        <div className="w-full bg-[#0a101d] border border-slate-800/80 rounded-2xl p-2.5 sm:p-3 transition-colors">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-300 font-medium">Entrada por Operação</span>
              <span className="text-[10px] text-slate-500 font-mono">90% payout</span>
            </div>

            {/* Valor da Entrada com Edição Rápida - Minimalista */}
            {isEditingEntradaInline ? (
              <div className="flex items-center gap-1">
                <div className="relative">
                  <span className="absolute left-2 top-1 text-[11px] text-gray-400 font-bold font-mono">R$</span>
                  <input
                    type="text"
                    autoFocus
                    value={inlineEntradaInput}
                    onChange={(e) => setInlineEntradaInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') salvarEdicaoEntradaInline();
                      if (e.key === 'Escape') setIsEditingEntradaInline(false);
                    }}
                    className="w-20 bg-[#060a14] border border-slate-600 focus:border-amber-400 rounded-md py-0.5 pl-6 pr-1.5 text-white font-mono-numbers font-semibold text-xs text-right focus:outline-none"
                    placeholder="50,00"
                  />
                </div>
                <button
                  onClick={salvarEdicaoEntradaInline}
                  className="p-1 text-emerald-400 hover:text-emerald-300 cursor-pointer"
                  title="Confirmar"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  if (!emExecucao) {
                    setInlineEntradaInput(valorEntrada.toFixed(2).replace('.', ','));
                    setIsEditingEntradaInline(true);
                  }
                }}
                className={`group flex items-center gap-1.5 bg-[#0e1628]/60 hover:bg-[#141f38] border border-slate-800 hover:border-slate-700 rounded-lg px-2.5 py-1 transition-all ${!emExecucao ? 'cursor-pointer' : ''}`}
                title="Clique para editar o valor da entrada"
              >
                <span className="text-xs sm:text-sm font-bold font-mono-numbers text-gray-100 group-hover:text-amber-300 transition-colors">
                  {formatoBRL(valorEntrada)}
                </span>
                <Edit2 className="w-2.5 h-2.5 text-slate-500 group-hover:text-amber-400 transition-colors" />
              </button>
            )}
          </div>

          {/* Atalhos rápidos minimalistas */}
          <div className="flex items-center justify-between gap-1 mt-2 pt-1.5 border-t border-slate-800/60">
            <span className="text-[10px] text-slate-500">Atalhos</span>
            <div className="flex items-center gap-1">
              {[10, 25, 50, 100, 200, 500].map(val => (
                <button
                  key={val}
                  disabled={emExecucao}
                  onClick={() => definirEntradaRapida(val)}
                  className={`px-1.5 py-0.5 text-[10px] font-mono-numbers rounded border transition-colors cursor-pointer ${
                    valorEntrada === val
                      ? 'bg-amber-400/15 text-amber-300 border-amber-500/30 font-semibold'
                      : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-white/5'
                  }`}
                >
                  R${val}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bloco de Saldos Estilo Terminal Petróleo com Contabilização Dinâmica */}
        <div className="relative my-0.5 bg-gradient-to-b from-[#12192b]/90 via-[#0d1322]/95 to-[#080d18] border border-[#23304d] rounded-2xl p-4 shadow-inner">
          <div className="flex flex-col items-center justify-center text-center space-y-3">
            <div className="relative flex flex-col items-center w-full">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[11px] text-[#9bb0db] font-semibold flex items-center gap-1">
                  <Fuel className="w-3 h-3 text-amber-400" />
                  Saldo em Conta
                </span>
                {!isEditingInline && !emExecucao && (
                  <button 
                    onClick={() => {
                      setInlineSaldoInput(saldo.toFixed(2).replace('.', ','));
                      setIsEditingInline(true);
                    }}
                    title="Editar saldo diretamente"
                    className="text-gray-400 hover:text-amber-400 transition-colors cursor-pointer"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                )}
              </div>
              
              {/* Floating Delta Badge */}
              {deltaBadge && (
                <div 
                  className={`absolute -top-4 z-20 flex items-center gap-0.5 text-xs font-black font-mono-numbers px-2.5 py-0.5 rounded-full shadow-lg animate-delta ${
                    deltaBadge.tipo === 'WIN' 
                      ? 'bg-emerald-950/95 text-[#00e676] border border-emerald-400/80 shadow-[0_0_14px_rgba(0,230,118,0.5)]' 
                      : deltaBadge.tipo === 'LOSS'
                        ? 'bg-red-950/95 text-[#ff3b53] border border-red-400/80 shadow-[0_0_14px_rgba(255,59,83,0.5)]'
                        : 'bg-slate-800 text-white border border-white/60'
                  }`}
                >
                  {deltaBadge.tipo === 'WIN' ? '+ ' : deltaBadge.tipo === 'LOSS' ? '- ' : ''}
                  {formatoBRL(deltaBadge.valor)}
                </div>
              )}
              
              {/* Saldo Editável Direto */}
              {isEditingInline ? (
                <div className="flex items-center gap-2 my-1">
                  <div className="relative flex items-center">
                    <span className="absolute left-2.5 text-amber-400 font-bold font-mono text-sm">R$</span>
                    <input 
                      type="text"
                      autoFocus
                      value={inlineSaldoInput}
                      onChange={(e) => setInlineSaldoInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') salvarEdicaoInline();
                        if (e.key === 'Escape') cancelarEdicaoInline();
                      }}
                      className="w-36 bg-[#040915] border-2 border-amber-400 rounded-xl py-1.5 pl-9 pr-2 text-white font-mono-numbers font-black text-xl text-center focus:outline-none shadow-lg shadow-amber-900/50"
                      placeholder="200,00"
                    />
                  </div>
                  <button 
                    onClick={salvarEdicaoInline} 
                    className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow cursor-pointer transition-colors"
                    title="Confirmar novo saldo"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={cancelarEdicaoInline} 
                    className="p-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-xl shadow cursor-pointer transition-colors"
                    title="Cancelar"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div 
                  onClick={() => {
                    if (!emExecucao) {
                      setInlineSaldoInput(saldo.toFixed(2).replace('.', ','));
                      setIsEditingInline(true);
                    }
                  }}
                  className={`group relative flex items-center gap-1.5 ${!emExecucao ? 'cursor-pointer' : ''}`}
                  title={!emExecucao ? 'Clique para editar o saldo' : ''}
                >
                  <h2 className="text-3xl sm:text-4xl font-black tracking-tight font-mono-numbers text-white transition-all duration-200 group-hover:text-amber-300">
                    {formatoBRL(displaySaldo)}
                  </h2>
                  {!emExecucao && (
                    <span className="opacity-0 group-hover:opacity-100 text-[10px] text-amber-300 bg-amber-950/80 border border-amber-700/80 px-1.5 py-0.5 rounded transition-opacity">
                      Editar
                    </span>
                  )}
                </div>
              )}

              {contabilizando && (
                <span className="text-[10px] font-bold uppercase tracking-wider mt-0.5 text-amber-400 animate-pulse flex items-center gap-1">
                  ▲ Contabilizando barris & lucros...
                </span>
              )}
            </div>

            <div className="w-full bg-[#070d1a]/85 border border-slate-800/80 rounded-xl py-2 px-3 flex items-center justify-between">
              <div className="text-left">
                <p className="text-[11px] text-[#8e86a0] font-medium leading-none">Lucro de Hoje</p>
                <h3 className={`text-xl sm:text-2xl font-bold tracking-tight font-mono-numbers leading-tight mt-0.5 ${displayLucro >= 0 ? 'text-[#00e676]' : 'text-[#ff3b53]'}`}>
                  {displayLucro >= 0 ? '+ ' : '- '}{formatoBRL(displayLucro)}
                </h3>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-amber-400 font-semibold block">99.4% assertivo</span>
                <p className="text-[10px] text-gray-400 font-medium font-mono-numbers">
                  <span className="text-emerald-400 font-bold">{winCount} WIN</span> / 
                  <span className="text-red-400 font-bold ml-1">{lossCount} LOSS</span> / 
                  <span className="text-gray-300 font-bold ml-1">{tieCount} EMP</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Status de Ativação do Poço */}
        <div className="w-full relative overflow-hidden rounded-xl py-2.5 px-4 transition-all duration-300 border-l-4 bg-[#0e1628] border-amber-500 text-amber-100/90 shadow-sm">
          <p className="text-xs font-semibold tracking-wide text-center truncate">
            {statusTexto}
          </p>
        </div>

        {/* Botão de Ação Verde Pulsante */}
        <button 
          onClick={iniciarSessao30s}
          disabled={emExecucao}
          className={`w-full relative overflow-hidden transition-all duration-200 text-white font-extrabold text-xs sm:text-sm py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-xl uppercase tracking-wide border border-emerald-400/40 ${
            emExecucao 
              ? 'bg-gradient-to-r from-emerald-600 via-teal-500 to-green-500 opacity-90 cursor-wait' 
              : 'bg-emerald-600 hover:bg-emerald-500 cursor-pointer animate-pulse-button shadow-emerald-950/60'
          }`}
        >
          <Zap className="w-4 h-4 text-emerald-200 animate-bounce" />
          <span className="font-extrabold tracking-wider text-white drop-shadow">
            {emExecucao 
              ? `OPERAÇÕES AUTOMÁTICAS (${segundosRestantes}s)` 
              : 'ATIVAR INTELIGÊNCIA ARTIFICIAL'}
          </span>
        </button>

        {/* Meta de Lucro com Barril */}
        <div className="space-y-1.5 pt-0.5">
          <div className="flex justify-between items-center text-xs text-[#9bb0db] font-medium px-1">
            <span className="flex items-center gap-1">
              <Target className="w-3.5 h-3.5 text-amber-400" />
              Meta de Lucro (Petróleo)
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono-numbers text-amber-300 font-semibold">{Math.round(metaPct)}%</span>
              <button 
                onClick={abrirModalConfig}
                className="text-gray-200 hover:text-amber-300 font-bold font-mono-numbers transition-colors cursor-pointer"
                title="Clique para alterar a meta"
              >
                {formatoBRL(metaLucroValor)}
              </button>
            </div>
          </div>
          <div className="w-full bg-[#0a1020] h-2.5 rounded-full overflow-hidden p-[1px] border border-slate-800">
            <div 
              className="bg-gradient-to-r from-amber-600 via-amber-400 to-[#00e676] h-full rounded-full transition-all duration-700" 
              style={{ width: `${metaPct}%` }}
            />
          </div>
        </div>

        {/* Gráfico de Operações com Candles em Tempo Real - PETRA (Petróleo) */}
        <div className="w-full bg-[#080d19] border border-[#232f4a] rounded-2xl p-3 flex flex-col gap-2 relative shadow-md">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <div className="flex flex-col">
                <span className="text-xs font-bold text-gray-100 flex items-center gap-1">
                  PETRA (Petróleo)
                  <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1 rounded font-mono">
                    COMMODITY
                  </span>
                </span>
                <span className="text-[9px] text-gray-400 font-mono">
                  BRENT CRUDE · {precoBarrilUSD}/barril
                </span>
              </div>
            </div>
            <span className="text-[11px] font-mono-numbers font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 rounded-md">
              {precoAtivo}
            </span>
          </div>

          <div className="relative w-full h-24 flex items-end justify-between gap-[2px] overflow-hidden px-1">
            {bars.map((h, i) => (
              <div 
                key={i} 
                className={`bar flex-1 rounded-full ${h > 45 ? 'bg-[#00e676]' : 'bg-[#ff3b53]'}`}
                style={{ height: `${h}%` }}
              />
            ))}
          </div>

          <div className="flex items-center justify-between text-[10px] text-gray-400 pt-1 border-t border-slate-800/60">
            <span className="flex items-center gap-1 text-amber-400/90 font-medium">
              <TrendingUp className="w-3 h-3 text-amber-400" /> Fluxo M1 · Entrada por Op: {formatoBRL(valorEntrada)}
            </span>
            <span className="font-mono text-gray-400">Volatilidade: Alta (OPEP+)</span>
          </div>
        </div>

        {/* Histórico de Operações no Petróleo */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-1 text-xs text-[#9bb0db] font-semibold">
            <span className="flex items-center gap-1">
              <BarChart2 className="w-3.5 h-3.5 text-amber-400" />
              Últimas Entradas em Petróleo ({historico.length})
            </span>
            {historico.length > 0 && (
              <button 
                onClick={limparHistorico} 
                className="text-[10px] text-gray-500 hover:text-red-400 transition-colors cursor-pointer"
              >
                Limpar
              </button>
            )}
          </div>
          <div className="max-h-36 overflow-y-auto space-y-1.5 pr-0.5 custom-scrollbar">
            {historico.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-3.5 text-center bg-[#070c17]/60 border border-slate-800/60 rounded-xl px-3">
                <p className="text-xs text-[#9bb0db] font-medium">O histórico de operações no petróleo aparecerá aqui.</p>
              </div>
            ) : (
              historico.map(op => {
                const corTexto = op.tipo === 'WIN' ? 'text-[#00e676]' : op.tipo === 'LOSS' ? 'text-[#ff3b53]' : 'text-white';
                const sinal = op.tipo === 'WIN' ? '+ ' : op.tipo === 'LOSS' ? '- ' : '';
                const rotulo = op.tipo === 'WIN' ? `WIN (${Math.round(op.payout * 100)}%) ✅` : op.tipo === 'LOSS' ? 'LOSS ❌' : 'EMPATE ⚪';

                return (
                  <div 
                    key={op.id} 
                    className="w-full bg-[#080d19] border border-[#232f4a] rounded-xl p-2.5 flex items-center justify-between text-xs transition-all hover:border-amber-500/50"
                  >
                    <div className="flex items-center gap-2">
                      <Droplet className="w-3 h-3 text-amber-400/80 shrink-0" />
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-200">{op.par}</span>
                        <span className="text-[9px] text-gray-400 font-mono">
                          Entrada: {formatoBRL(op.valorEntrada)} · {op.dir} M1
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`font-bold font-mono-numbers ${corTexto}`}>
                        {sinal}{formatoBRL(op.valor)}
                      </span>
                      <span className="text-[9px] block text-gray-400 font-medium">
                        {rotulo}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Rodapé: Prova Social & Contador Online no Mercado de Petróleo */}
        <div className="space-y-1.5 mt-auto pt-1">
          <div className="w-full bg-[#0a1020]/95 border border-amber-900/40 rounded-xl py-2 px-3 flex items-center justify-center gap-2 text-xs shadow-sm">
            <span className="text-amber-400 text-sm">🛢️ 📊</span>
            <span className="text-[#00e676] font-semibold truncate">
              {notificacaoLucro}
            </span>
          </div>
          <div className="w-full bg-[#080d1a] border border-[#232f4a] rounded-xl py-2 px-3 flex items-center justify-center gap-2 text-xs text-gray-200 shadow-sm">
            <Users className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-medium">
              <strong className="text-white font-bold font-mono-numbers mr-1">
                {onlineCounter.toLocaleString('pt-BR')}
              </strong> 
              traders operando petróleo agora
            </span>
          </div>
        </div>

      </main>

      {/* POPUP CENTRALIZADO
          Regra:
          - Ganhar: VERDE
          - Perder: VERMELHO
          - Empatar: BRANCO
      */}
      {popupData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-[2px] transition-opacity">
          <div 
            className={`relative w-full max-w-[340px] rounded-2xl p-5 text-center transition-all ${
              popupData.op.tipo === 'WIN'
                ? 'border-2 border-[#00e676] bg-[#032314]/95 shadow-[0_0_40px_rgba(0,230,118,0.5)]'
                : popupData.op.tipo === 'LOSS'
                  ? 'border-2 border-[#ff3b53] bg-[#29050d]/95 shadow-[0_0_40px_rgba(255,59,83,0.5)]'
                  : 'border-2 border-white bg-[#0f172a]/95 text-white shadow-[0_0_40px_rgba(255,255,255,0.45)]'
            }`}
          >
            <button 
              onClick={fecharPopup} 
              className="absolute top-3 right-3 text-gray-400 hover:text-white text-sm p-1 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center justify-between text-[11px] text-gray-300 mb-2 px-1 font-semibold">
              <span className="uppercase tracking-wider">Operação {popupData.index} de {popupData.total}</span>
              <span className="text-[10px] text-amber-300 font-mono">{popupData.op.par}</span>
            </div>

            <div className="text-4xl my-2 flex justify-center">
              {popupData.op.tipo === 'WIN' && <CheckCircle2 className="w-12 h-12 text-[#00e676] animate-bounce" />}
              {popupData.op.tipo === 'LOSS' && <XCircle className="w-12 h-12 text-[#ff3b53]" />}
              {popupData.op.tipo === 'EMPATE' && <MinusCircle className="w-12 h-12 text-white" />}
            </div>

            <span 
              className={`text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider inline-block mb-1 ${
                popupData.op.tipo === 'WIN'
                  ? 'bg-emerald-950 border border-emerald-500/50 text-[#00e676]'
                  : popupData.op.tipo === 'LOSS'
                    ? 'bg-red-950 border border-red-500/50 text-[#ff3b53]'
                    : 'bg-slate-800 border border-white/60 text-white'
              }`}
            >
              {popupData.op.tipo === 'WIN' && `LUCRO OBTIDO (${Math.round(popupData.op.payout * 100)}% PAYOUT)`}
              {popupData.op.tipo === 'LOSS' && 'PREJUÍZO COMPUTADO'}
              {popupData.op.tipo === 'EMPATE' && 'OPERAÇÃO EMPATADA'}
            </span>

            {/* Informação do Valor da Entrada */}
            <div className="text-[11px] text-gray-300 font-mono">
              Valor da Entrada: <strong className="text-white font-bold">{formatoBRL(popupData.op.valorEntrada)}</strong>
            </div>

            <div className="my-2">
              <span className="text-[11px] text-gray-300 block font-medium">Resultado da Operação</span>
              <h2 
                className={`text-3xl sm:text-4xl font-black font-mono-numbers tracking-tight mt-0.5 ${
                  popupData.op.tipo === 'WIN'
                    ? 'text-[#00e676]'
                    : popupData.op.tipo === 'LOSS'
                      ? 'text-[#ff3b53]'
                      : 'text-white'
                }`}
              >
                {popupData.op.tipo === 'WIN' && `+ ${formatoBRL(popupData.op.valor)}`}
                {popupData.op.tipo === 'LOSS' && `- ${formatoBRL(popupData.op.valor)}`}
                {popupData.op.tipo === 'EMPATE' && 'R$ 0,00'}
              </h2>
            </div>

            <div className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 my-3">
              <span className="text-gray-300 font-medium text-[11px]">Saldo Atualizado:</span>
              <span className="font-black text-white font-mono-numbers text-sm">
                {formatoBRL(popupData.novoSaldo)}
              </span>
            </div>

            {/* Dynamic Countdown Bar */}
            <div className="w-full bg-black/50 h-1.5 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-75 ${
                  popupData.op.tipo === 'WIN'
                    ? 'bg-[#00e676]'
                    : popupData.op.tipo === 'LOSS'
                      ? 'bg-[#ff3b53]'
                      : 'bg-white'
                }`}
                style={{ width: `${popupBarWidth}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal de Reinício de Sessão */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#0b1324] border border-amber-600/50 rounded-2xl p-5 max-w-[340px] w-full text-center shadow-2xl">
            <div className="w-10 h-10 rounded-full bg-amber-900/40 text-amber-400 flex items-center justify-center mx-auto mb-3 border border-amber-500/40">
              <RotateCcw className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Reiniciar Sessão?</h3>
            <p className="text-xs text-gray-300 mb-4">
              Isso irá zerar as operações e restaurar o saldo para {formatoBRL(saldo)}.
            </p>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowResetModal(false)}
                className="flex-1 py-2 px-3 rounded-xl border border-gray-700 text-gray-300 text-xs font-semibold hover:bg-white/5 cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                onClick={reiniciarSessao}
                className="flex-1 py-2 px-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold cursor-pointer"
              >
                Sim, Reiniciar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Completo de Configurações: Entrada por Operação, Saldo e Meta */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0b1324] border border-amber-500/50 rounded-2xl p-5 max-w-[370px] w-full shadow-2xl relative">
            <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2.5">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-400" />
                Configurar Parâmetros de Operação
              </h3>
              <button 
                onClick={() => setShowConfigModal(false)} 
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* SEÇÃO PRINCIPAL: DEFINIR ENTRADA POR OPERAÇÃO */}
            <div className="space-y-1.5 mb-3.5 bg-gradient-to-r from-amber-950/40 to-yellow-950/20 border border-amber-500/40 rounded-xl p-3">
              <label className="text-xs font-bold text-amber-300 flex items-center justify-between">
                <span>Valor da Entrada por Operação (R$)</span>
                <span className="text-[10px] text-amber-400 font-mono font-normal">Investimento por ordem</span>
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-base font-bold text-amber-400 font-mono">R$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={inputEntradaTexto}
                  onChange={(e) => setInputEntradaTexto(e.target.value)}
                  placeholder="50,00"
                  className="w-full bg-[#050914] border-2 border-amber-500/60 focus:border-amber-400 rounded-xl py-2 pl-11 pr-4 text-white font-mono-numbers font-black text-xl focus:outline-none transition-all shadow-inner"
                />
              </div>
              <p className="text-[10px] text-gray-300">
                Digite quanto deseja entrar em cada ordem (ex: 20, 50, 100, 250, 500). Payout médio de 90%.
              </p>

              {/* Botões Rápidos de Entrada */}
              <div className="grid grid-cols-6 gap-1 pt-1">
                {[10, 25, 50, 100, 200, 500].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => {
                      setInputEntradaTexto(val.toFixed(2).replace('.', ','));
                      setInputMetaTexto((val * 3.5).toFixed(2).replace('.', ','));
                    }}
                    className="py-1 px-1 text-center text-xs font-mono-numbers font-bold rounded-lg border border-amber-500/40 bg-[#081021] hover:bg-amber-500 hover:text-black text-amber-200 transition-all cursor-pointer"
                  >
                    R${val}
                  </button>
                ))}
              </div>
            </div>

            {/* Campo Editável: Saldo da Banca */}
            <div className="space-y-1.5 mb-3">
              <label className="text-xs font-semibold text-gray-300 flex items-center justify-between">
                <span>Saldo em Conta (R$)</span>
                <span className="text-[10px] text-gray-400">Totalmente Editável</span>
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-sm font-bold text-gray-400 font-mono">R$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={inputSaldoTexto}
                  onChange={(e) => setInputSaldoTexto(e.target.value)}
                  placeholder="200,00"
                  className="w-full bg-[#050914] border border-slate-700 focus:border-amber-400 rounded-xl py-2 pl-10 pr-4 text-white font-mono-numbers font-bold text-base focus:outline-none transition-all shadow-inner"
                />
              </div>
            </div>

            {/* Campo Editável: Meta de Lucro */}
            <div className="space-y-1.5 mb-4">
              <label className="text-xs font-semibold text-gray-300 flex items-center justify-between">
                <span>Meta de Lucro Desejada (R$)</span>
                <span className="text-[10px] text-emerald-400">Objetivo</span>
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-sm font-bold text-emerald-400 font-mono">R$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={inputMetaTexto}
                  onChange={(e) => setInputMetaTexto(e.target.value)}
                  placeholder="200,00"
                  className="w-full bg-[#050914] border border-slate-700 focus:border-emerald-400 rounded-xl py-2 pl-10 pr-4 text-white font-mono-numbers font-bold text-base focus:outline-none transition-all shadow-inner"
                />
              </div>
            </div>

            {/* Botões de Ação */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={salvarConfiguracao}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-950/50 transition-all cursor-pointer"
              >
                Salvar Valores
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
