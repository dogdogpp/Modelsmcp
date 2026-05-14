import { Outlet, NavLink } from "react-router";
import { useState } from "react";
import {
  Brain,
  Zap,
  BookOpen,
  PlayCircle,
  Menu,
  X,
  Github,
  Terminal,
  Radio,
} from "lucide-react";

const navItems = [
  { to: "/", label: "首页", end: true },
  { to: "/models", label: "模型市场" },
  { to: "/playground", label: "Playground" },
  { to: "/docs", label: "文档" },
  { to: "/status", label: "状态" },
  { to: "/subscriptions", label: "订阅" },
  { to: "/settings/communication", label: "通信设置" },
];

export function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#080b14] text-white">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#080b14]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <NavLink to="/" className="flex items-center gap-2.5 group">
              <div className="relative w-8 h-8">
                <div className="absolute inset-0 bg-cyan-500/30 rounded-lg blur-md group-hover:bg-cyan-400/40 transition-all" />
                <div className="relative w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-lg flex items-center justify-center">
                  <Brain size={16} className="text-white" />
                </div>
              </div>
              <div>
                <span className="text-white" style={{ fontSize: "1.05rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
                  DeepMCP
                </span>
                <span className="text-cyan-400" style={{ fontSize: "1.05rem", fontWeight: 700 }}>.hub</span>
              </div>
            </NavLink>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `px-4 py-2 rounded-lg text-sm transition-all ${
                      isActive
                        ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                        : "text-gray-400 hover:text-white hover:bg-white/5"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>

            {/* Right actions */}
            <div className="hidden md:flex items-center gap-3">
              <a
                href="#"
                className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors"
              >
                <Github size={16} />
                <span>GitHub</span>
              </a>

              <NavLink
                to="/playground"
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm rounded-lg hover:opacity-90 transition-opacity"
              >
                <Terminal size={14} />
                <span>快速开始</span>
              </NavLink>
            </div>

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2 text-gray-400 hover:text-white"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-white/5 bg-[#080b14]/95 px-4 py-3 flex flex-col gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `px-4 py-2.5 rounded-lg text-sm transition-all ${
                    isActive
                      ? "bg-cyan-500/10 text-cyan-400"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        )}
      </nav>

      {/* Main content */}
      <main className="pt-16">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-[#060910] mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-7 h-7 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-lg flex items-center justify-center">
                  <Brain size={14} className="text-white" />
                </div>
                <span style={{ fontWeight: 700 }}>
                  DeepMCP<span className="text-cyan-400">.hub</span>
                </span>
              </div>
              <p className="text-gray-500 text-sm leading-relaxed max-w-sm">
                开源深度学习模型 MCP 服务平台，支持本地推理，兼容所有 MCP 客户端，让 AI 能力触手可及。
              </p>
              <div className="flex items-center gap-3 mt-4">
                <a href="#" className="text-gray-500 hover:text-cyan-400 transition-colors">
                  <Github size={18} />
                </a>
              </div>
            </div>
            <div>
              <h4 className="text-white text-sm mb-4" style={{ fontWeight: 600 }}>产品</h4>
              <ul className="space-y-2">
                {["模型市场", "Playground", "本地部署", "API 文档"].map((item) => (
                  <li key={item}>
                    <a href="#" className="text-gray-500 hover:text-white text-sm transition-colors">{item}</a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-white text-sm mb-4" style={{ fontWeight: 600 }}>资源</h4>
              <ul className="space-y-2">
                {["快速开始", "MCP 规范", "示例代码", "社区论坛"].map((item) => (
                  <li key={item}>
                    <a href="#" className="text-gray-500 hover:text-white text-sm transition-colors">{item}</a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="border-t border-white/5 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-gray-600 text-sm">© 2026 DeepMCP.hub · 基于 MCP 协议构建</p>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-gray-600 text-sm">所有服务运行正常</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
