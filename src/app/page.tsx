'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import TabNav, { TabId } from '@/components/TabNav';
import { RecallCheckResult, Vehicle, Alert, InventorySummary, MAKERS, MAKER_RECALL_URLS, Maker, Manufacturer, VehicleModel, ModelType } from '@/types';
import { AlertCircle, CheckCircle, Loader2, Trash2, Plus, ExternalLink, Search } from 'lucide-react';

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>('check');

  // 検索モード ('chassis' | 'model') - デフォルトは車種・型式検索
  const [searchMode, setSearchMode] = useState<'chassis' | 'model'>('model');

  // 車台番号検索
  const [chassisNumber, setChassisNumber] = useState('');
  const [selectedMaker, setSelectedMaker] = useState('');
  const [searchResult, setSearchResult] = useState<RecallCheckResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  // 車種・型式検索
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [selectedManufacturer, setSelectedManufacturer] = useState('');
  const [modelQuery, setModelQuery] = useState('');
  const [filteredModels, setFilteredModels] = useState<VehicleModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<VehicleModel | null>(null);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [modelTypes, setModelTypes] = useState<ModelType[]>([]);
  const [selectedType, setSelectedType] = useState('');

  // 在庫
  const [inventory, setInventory] = useState<Vehicle[]>([]);
  const [summary, setSummary] = useState<InventorySummary>({ total: 0, withRecall: 0, withoutRecall: 0 });
  const [newCar, setNewCar] = useState({ chassisNumber: '', maker: '', model: '', year: '' });
  const [isAddingCar, setIsAddingCar] = useState(false);

  // アラート
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // リコールニュース
  interface RecallNews {
    maker: string;
    title: string;
    date: string;
    url: string;
  }
  const [recallNews, setRecallNews] = useState<RecallNews[]>([]);
  const [isLoadingNews, setIsLoadingNews] = useState(true);

  // 在庫読み込み
  const loadInventory = async () => {
    try {
      const res = await fetch('/api/inventory');
      const data = await res.json();
      if (data.success) {
        setInventory(data.data);
        setSummary(data.summary);
      }
    } catch (error) {
      console.error('在庫読み込みエラー:', error);
    }
  };

  // アラート読み込み
  const loadAlerts = async () => {
    try {
      const res = await fetch('/api/alerts');
      const data = await res.json();
      if (data.success) {
        setAlerts(data.data);
        setUnreadCount(data.unreadCount);
      }
    } catch (error) {
      console.error('アラート読み込みエラー:', error);
    }
  };

  // リコールニュース読み込み
  const loadRecallNews = async () => {
    setIsLoadingNews(true);
    try {
      const res = await fetch('/api/recall/news');
      const data = await res.json();
      if (data.success) {
        setRecallNews(data.data);
      }
    } catch (error) {
      console.error('リコールニュース読み込みエラー:', error);
    } finally {
      setIsLoadingNews(false);
    }
  };

  useEffect(() => {
    loadInventory();
    loadAlerts();
    loadRecallNews();
    loadManufacturers();
  }, []);

  // メーカー一覧取得
  const loadManufacturers = async () => {
    try {
      const res = await fetch('/api/manufacturers');
      const data = await res.json();
      if (data.success) {
        setManufacturers(data.data);
      }
    } catch (error) {
      console.error('メーカー読み込みエラー:', error);
    }
  };

  // 車種検索（インクリメンタル）
  useEffect(() => {
    // 既に車種が選択されている場合は検索しない
    if (selectedModel) {
      setFilteredModels([]);
      setShowModelDropdown(false);
      return;
    }

    if (modelQuery.length > 0) {
      const searchModels = async () => {
        try {
          // メーカー指定がある場合とない場合でURLを変更
          const url = selectedManufacturer
            ? `/api/models?maker=${selectedManufacturer}&q=${encodeURIComponent(modelQuery)}`
            : `/api/models?q=${encodeURIComponent(modelQuery)}`;

          const res = await fetch(url);
          const data = await res.json();
          if (data.success) {
            setFilteredModels(data.data);
            setShowModelDropdown(true);
          }
        } catch (error) {
          console.error('車種検索エラー:', error);
        }
      };

      // デバウンス処理（300ms待機）
      const timer = setTimeout(searchModels, 300);
      return () => clearTimeout(timer);
    } else {
      setFilteredModels([]);
      setShowModelDropdown(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedManufacturer, modelQuery]);

  // 型式一覧取得
  useEffect(() => {
    if (selectedModel) {
      const loadTypes = async () => {
        try {
          const res = await fetch(`/api/models/${selectedModel.id}/types`);
          const data = await res.json();
          if (data.success) {
            setModelTypes(data.data);
          }
        } catch (error) {
          console.error('型式読み込みエラー:', error);
        }
      };

      loadTypes();
    } else {
      setModelTypes([]);
      setSelectedType('');
    }
  }, [selectedModel]);

  // リコール検索
  const handleSearch = async () => {
    // バリデーション
    if (searchMode === 'chassis') {
      if (!chassisNumber.trim()) return;
    } else {
      if (!selectedModel || !selectedType) {
        setSearchError('車種と型式を選択してください');
        return;
      }
    }

    setIsSearching(true);
    setSearchResult(null);
    setSearchError('');

    try {
      const requestBody = searchMode === 'chassis'
        ? {
            searchMethod: 'chassis',
            chassisNumber: chassisNumber.trim(),
            maker: selectedMaker || undefined,
            skipCache: true
          }
        : {
            searchMethod: 'model',
            modelName: selectedModel?.name,
            modelType: selectedType
          };

      const res = await fetch('/api/recall/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const data = await res.json();

      if (data.success) {
        setSearchResult(data.data);
      } else {
        setSearchError(data.error || '検索に失敗しました');
      }
    } catch (error) {
      setSearchError('通信エラーが発生しました');
    } finally {
      setIsSearching(false);
    }
  };

  // 検索モード切り替え時のリセット
  const handleSearchModeChange = (mode: 'chassis' | 'model') => {
    setSearchMode(mode);
    setSearchResult(null);
    setSearchError('');

    // 各モードの入力値をリセット
    if (mode === 'chassis') {
      setSelectedManufacturer('');
      setModelQuery('');
      setSelectedModel(null);
      setSelectedType('');
    } else {
      setChassisNumber('');
      setSelectedMaker('');
    }
  };

  // 在庫追加
  const handleAddCar = async () => {
    if (!newCar.chassisNumber.trim() || !newCar.maker) return;

    setIsAddingCar(true);

    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCar),
      });

      const data = await res.json();

      if (data.success) {
        setNewCar({ chassisNumber: '', maker: '', model: '', year: '' });
        loadInventory();
      } else {
        alert(data.error || '追加に失敗しました');
      }
    } catch (error) {
      alert('通信エラーが発生しました');
    } finally {
      setIsAddingCar(false);
    }
  };

  // 在庫削除
  const handleDeleteCar = async (id: string) => {
    if (!confirm('この車両を削除しますか？')) return;

    try {
      const res = await fetch(`/api/inventory/${id}`, { method: 'DELETE' });
      const data = await res.json();

      if (data.success) {
        loadInventory();
      } else {
        alert(data.error || '削除に失敗しました');
      }
    } catch (error) {
      alert('通信エラーが発生しました');
    }
  };

  // 全て既読
  const handleMarkAllRead = async () => {
    try {
      await fetch('/api/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'markAllRead' }),
      });
      loadAlerts();
    } catch (error) {
      console.error('既読エラー:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        unreadCount={unreadCount}
        onAlertClick={() => setActiveTab('alerts')}
      />
      <TabNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        unreadAlertCount={unreadCount}
      />

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* 単発チェックタブ */}
        {activeTab === 'check' && (
          <div className="space-y-6">
            {/* 検索モード切り替え */}
            <div className="flex gap-2">
              <button
                onClick={() => handleSearchModeChange('model')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  searchMode === 'model'
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                車種・型式で検索
              </button>
              <button
                onClick={() => handleSearchModeChange('chassis')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  searchMode === 'chassis'
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                車台番号で検索
              </button>
            </div>

            {/* 車台番号検索フォーム */}
            {searchMode === 'chassis' && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex flex-col md:flex-row gap-3">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      placeholder="車台番号を入力（例：S700B-0005456）"
                      value={chassisNumber}
                      onChange={(e) => setChassisNumber(e.target.value.toUpperCase())}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      className="w-full px-4 py-3.5 bg-gray-50 border-0 rounded-xl focus:ring-2 focus:ring-gray-200 focus:bg-white outline-none text-base font-mono text-gray-800 placeholder:text-gray-400 transition-all"
                    />
                  </div>
                  <select
                    value={selectedMaker}
                    onChange={(e) => setSelectedMaker(e.target.value)}
                    className={`px-4 py-3.5 border-0 rounded-xl focus:ring-2 focus:ring-gray-200 outline-none text-sm cursor-pointer ${
                      selectedMaker ? 'bg-gray-50 text-gray-700' : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    <option value="">メーカーを選択</option>
                    {MAKERS.map(maker => (
                      <option key={maker} value={maker}>{maker}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleSearch}
                    disabled={isSearching || !chassisNumber.trim() || !selectedMaker}
                    className="px-6 py-3.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 min-w-[100px]"
                  >
                    {isSearching ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : '検索'}
                  </button>
                </div>
                <p className="text-gray-500 text-xs mt-3">
                  対応メーカー：トヨタ・日産・ホンダ・マツダ・スバル・ダイハツ
                </p>
              </div>
            )}

            {/* 車種・型式検索フォーム */}
            {searchMode === 'model' && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="space-y-4">
                  {/* 車種名検索（インクリメンタル） */}
                  <div className="relative">
                    <label className="block text-xs font-medium text-gray-500 mb-2">車種名</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={modelQuery}
                        onChange={(e) => setModelQuery(e.target.value)}
                        onFocus={() => filteredModels.length > 0 && setShowModelDropdown(true)}
                        placeholder="車種名を入力（例：ロードスター、ハイゼットカーゴ）"
                        className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl focus:ring-2 focus:ring-gray-200 outline-none text-sm"
                      />
                      <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    </div>

                    {/* 候補リスト */}
                    {showModelDropdown && filteredModels.length > 0 && (
                      <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                        {filteredModels.map(model => (
                          <button
                            key={model.id}
                            onClick={() => {
                              setSelectedModel(model);
                              setModelQuery(model.name);
                              setShowModelDropdown(false);
                              // メーカーも自動選択
                              if (model.manufacturer) {
                                setSelectedManufacturer(model.manufacturerId);
                              }
                            }}
                            className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="font-medium text-gray-800">{model.name}</div>
                                {model.nameKana && (
                                  <div className="text-xs text-gray-500 mt-0.5">{model.nameKana}</div>
                                )}
                              </div>
                              {model.manufacturer && (
                                <div className="text-xs text-gray-400 ml-2">
                                  {model.manufacturer.name}
                                </div>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {selectedModel && (
                      <div className="mt-2 px-3 py-2 bg-emerald-50 rounded-lg text-sm text-emerald-700 flex items-center justify-between">
                        <span>選択中: {selectedModel.name}</span>
                        {selectedModel.manufacturer && (
                          <span className="text-xs">({selectedModel.manufacturer.name})</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* メーカー選択（オプショナル・絞り込み用） */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-2">
                      メーカーで絞り込み（オプション）
                    </label>
                    <select
                      value={selectedManufacturer}
                      onChange={(e) => {
                        setSelectedManufacturer(e.target.value);
                        setModelQuery('');
                        setSelectedModel(null);
                      }}
                      className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl focus:ring-2 focus:ring-gray-200 outline-none text-sm cursor-pointer"
                    >
                      <option value="">すべてのメーカー</option>
                      {manufacturers.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* 型式選択 */}
                  {selectedModel && modelTypes.length > 0 && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-2">
                        グレード・型式 ({modelTypes.length}件)
                      </label>
                      <select
                        value={selectedType}
                        onChange={(e) => setSelectedType(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl focus:ring-2 focus:ring-gray-200 outline-none text-sm cursor-pointer"
                      >
                        <option value="">グレード・型式を選択してください</option>
                        {modelTypes.map(type => {
                          // グレード名と型式を組み合わせて表示
                          let displayText = type.typeCode;

                          if (type.gradeName) {
                            displayText = `${type.gradeName} - ${type.typeCode}`;
                          }

                          // 追加情報があれば表示
                          const details = [];
                          if (type.displacement) details.push(type.displacement);
                          if (type.transmission) details.push(type.transmission);
                          if (type.driveSystem) details.push(type.driveSystem);

                          if (details.length > 0) {
                            displayText += ` (${details.join(', ')})`;
                          } else if (type.description) {
                            displayText += ` (${type.description})`;
                          }

                          return (
                            <option key={type.id} value={type.typeCode}>
                              {displayText}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}

                  {/* 型式データがない場合の警告 */}
                  {selectedModel && modelTypes.length === 0 && (
                    <div className="px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-700">
                      この車種の型式データはまだ取得されていません。型式データがある車種を選択してください。
                    </div>
                  )}

                  {/* 検索ボタン */}
                  <button
                    onClick={handleSearch}
                    disabled={isSearching || !selectedModel || !selectedType}
                    className="w-full px-6 py-3.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  >
                    {isSearching ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>検索中...</span>
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4" />
                        リコールを検索
                      </>
                    )}
                  </button>
                </div>

                {isSearching && (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mt-4">
                    <div className="flex items-start gap-3">
                      <Loader2 className="w-5 h-5 animate-spin text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-blue-900 mb-1">
                          国土交通省データベースから検索中
                        </p>
                        <p className="text-xs text-blue-700">
                          リコール情報の取得には1〜2分程度かかる場合があります。このままお待ちください。
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <p className="text-gray-500 text-xs mt-4">
                  国土交通省のデータベースから検索します
                </p>
              </div>
            )}

            {/* エラー表示 */}
            {searchError && (
              <div className="bg-white rounded-2xl border border-red-100 p-5">
                <div className="flex items-center gap-3 text-red-600">
                  <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <span className="text-sm">{searchError}</span>
                </div>
              </div>
            )}

            {/* 検索結果 - 検索窓のすぐ下に表示 */}
            {searchResult && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className={`p-5 ${searchResult.hasRecall ? 'bg-red-50' : 'bg-emerald-50'}`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      searchResult.hasRecall ? 'bg-red-100' : 'bg-emerald-100'
                    }`}>
                      {searchResult.hasRecall ? (
                        <AlertCircle className="w-6 h-6 text-red-600" />
                      ) : (
                        <CheckCircle className="w-6 h-6 text-emerald-600" />
                      )}
                    </div>
                    <div>
                      <h3 className={`font-semibold ${searchResult.hasRecall ? 'text-red-900' : 'text-emerald-900'}`}>
                        {searchResult.hasRecall ? 'リコール対象です' : 'リコール対象ではありません'}
                      </h3>
                      <p className="text-sm text-gray-600 mt-0.5">
                        {searchResult.maker} / {searchResult.chassisNumber}
                        {searchResult.cached && <span className="text-gray-400 ml-2">(キャッシュ)</span>}
                      </p>
                    </div>
                  </div>
                </div>

                {searchResult.hasRecall && searchResult.recalls.length > 0 && (
                  <div className="p-5">
                    <div className="text-xs text-gray-400 tracking-wider mb-4">
                      リコール情報 {searchResult.recalls.length}件
                    </div>
                    <div className="space-y-3">
                      {searchResult.recalls.map((recall, idx) => (
                        <div key={idx} className="p-4 bg-gray-50 rounded-xl">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${
                                  recall.severity === 'high' ? 'bg-red-100 text-red-700' :
                                  recall.severity === 'medium' ? 'bg-amber-100 text-amber-700' :
                                  'bg-gray-100 text-gray-600'
                                }`}>
                                  {recall.severity === 'high' ? '重要' : recall.severity === 'medium' ? '注意' : '情報'}
                                </span>
                                <span className="text-xs text-gray-400">{recall.publishedAt}</span>
                              </div>
                              <h5 className="font-medium text-gray-800 text-sm">{recall.title}</h5>
                              {recall.description && (
                                <p className="text-gray-500 text-sm mt-1.5">
                                  {recall.description.includes('http') ? (
                                    <>
                                      {recall.description.replace(/https?:\/\/[^\s]+/g, '')}
                                      <a
                                        href={recall.description.match(/https?:\/\/[^\s]+/)?.[0]}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-gray-700 hover:text-gray-900 inline-flex items-center gap-1 ml-1 underline underline-offset-2"
                                      >
                                        詳細を見る
                                        <ExternalLink className="w-3 h-3" />
                                      </a>
                                    </>
                                  ) : recall.description}
                                </p>
                              )}
                              {/* ソース元リンク */}
                              {recall.detailUrl && (
                                <div className="flex items-center gap-3 mt-2.5">
                                  <a
                                    href={recall.detailUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-gray-400 hover:text-gray-600 inline-flex items-center gap-1 transition-colors"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    国交省で詳細を見る
                                  </a>
                                </div>
                              )}
                            </div>
                            <span className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium ${
                              recall.status === 'pending' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              {recall.status === 'pending' ? '未対応' : '対応済'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 公式サイトリンク */}
                <div className="px-5 py-4 border-t border-gray-100 space-y-2">
                  <div className="flex flex-wrap items-center gap-4">
                    <a
                      href={MAKER_RECALL_URLS[searchResult.maker as Maker] || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      {searchResult.maker}公式サイトで確認
                    </a>
                    <a
                      href="https://renrakuda.mlit.go.jp/renrakuda/announce.html"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      国土交通省リコール情報
                    </a>
                  </div>
                  <p className="text-xs text-gray-400">
                    出典：国土交通省ウェブサイト（自動車のリコール・不具合情報）
                  </p>
                </div>
              </div>
            )}

            {/* リコールニュースポータル */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-sm font-semibold text-gray-800 tracking-wider">最新リコール情報</h2>
                <span className="text-xs text-gray-500">各メーカー公式サイトより</span>
              </div>
              {isLoadingNews ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                  <span className="ml-2 text-sm text-gray-400">読み込み中...</span>
                </div>
              ) : recallNews.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {MAKERS.map(maker => {
                    const makerNews = recallNews.filter(n => n.maker === maker);
                    if (makerNews.length === 0) return null;
                    return (
                      <div key={maker} className="group">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="w-1.5 h-4 bg-gray-900 rounded-full"></span>
                          <span className="text-sm font-semibold text-gray-800">{maker}</span>
                        </div>
                        <div className="space-y-2">
                          {makerNews.slice(0, 3).map((news, idx) => (
                            <a
                              key={idx}
                              href={news.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block p-3 bg-gray-100 rounded-lg hover:bg-gray-200 transition-all duration-200 group/item"
                            >
                              <div className="text-sm text-gray-700 line-clamp-2 group-hover/item:text-gray-900 transition-colors">{news.title}</div>
                              {news.date && (
                                <div className="text-xs text-gray-500 mt-1.5 font-medium">{news.date}</div>
                              )}
                            </a>
                          ))}
                        </div>
                        <a
                          href={MAKER_RECALL_URLS[maker as Maker]}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 mt-3 text-xs text-gray-500 hover:text-gray-700 font-medium transition-colors"
                        >
                          すべて見る
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-sm text-gray-400">
                  リコール情報を取得できませんでした
                </div>
              )}
            </div>
          </div>
        )}

        {/* 在庫管理タブ */}
        {activeTab === 'inventory' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <input
                  type="text"
                  placeholder="車台番号"
                  value={newCar.chassisNumber}
                  onChange={(e) => setNewCar({...newCar, chassisNumber: e.target.value.toUpperCase()})}
                  className="px-3 py-2.5 bg-gray-50 border-0 rounded-lg focus:ring-2 focus:ring-gray-200 outline-none text-sm font-mono"
                />
                <select
                  value={newCar.maker}
                  onChange={(e) => setNewCar({...newCar, maker: e.target.value})}
                  className="px-3 py-2.5 bg-gray-50 border-0 rounded-lg focus:ring-2 focus:ring-gray-200 outline-none text-sm cursor-pointer"
                >
                  <option value="">メーカー</option>
                  {MAKERS.map(maker => (
                    <option key={maker} value={maker}>{maker}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="車種名"
                  value={newCar.model}
                  onChange={(e) => setNewCar({...newCar, model: e.target.value})}
                  className="px-3 py-2.5 bg-gray-50 border-0 rounded-lg focus:ring-2 focus:ring-gray-200 outline-none text-sm"
                />
                <input
                  type="text"
                  placeholder="年式"
                  value={newCar.year}
                  onChange={(e) => setNewCar({...newCar, year: e.target.value})}
                  className="px-3 py-2.5 bg-gray-50 border-0 rounded-lg focus:ring-2 focus:ring-gray-200 outline-none text-sm"
                />
                <button
                  onClick={handleAddCar}
                  disabled={!newCar.chassisNumber.trim() || !newCar.maker || isAddingCar}
                  className="px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
                >
                  {isAddingCar ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  追加
                </button>
              </div>
            </div>

            {/* サマリー */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <div className="text-3xl font-semibold text-gray-800">{summary.total}</div>
                <div className="text-gray-400 text-sm mt-1">総在庫</div>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <div className="text-3xl font-semibold text-red-600">{summary.withRecall}</div>
                <div className="text-gray-400 text-sm mt-1">リコール対象</div>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <div className="text-3xl font-semibold text-emerald-600">{summary.withoutRecall}</div>
                <div className="text-gray-400 text-sm mt-1">問題なし</div>
              </div>
            </div>

            {/* テーブル */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {inventory.length > 0 ? (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="px-5 py-4 text-left text-xs font-medium text-gray-400 tracking-wider">車台番号</th>
                      <th className="px-5 py-4 text-left text-xs font-medium text-gray-400 tracking-wider">メーカー</th>
                      <th className="px-5 py-4 text-left text-xs font-medium text-gray-400 tracking-wider">車種</th>
                      <th className="px-5 py-4 text-left text-xs font-medium text-gray-400 tracking-wider">年式</th>
                      <th className="px-5 py-4 text-center text-xs font-medium text-gray-400 tracking-wider">状態</th>
                      <th className="px-5 py-4 text-center text-xs font-medium text-gray-400 tracking-wider"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {inventory.map((car) => (
                      <tr key={car.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-5 py-4 font-mono text-sm text-gray-700">{car.chassisNumber}</td>
                        <td className="px-5 py-4 text-sm text-gray-600">{car.maker}</td>
                        <td className="px-5 py-4 text-sm text-gray-600">{car.model || '-'}</td>
                        <td className="px-5 py-4 text-sm text-gray-600">{car.year || '-'}</td>
                        <td className="px-5 py-4 text-center">
                          {car.recallCount > 0 ? (
                            <span className="px-2.5 py-1 bg-red-50 text-red-600 rounded-lg text-xs font-medium">
                              リコール {car.recallCount}件
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-medium">
                              問題なし
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-center">
                          <button
                            onClick={() => handleDeleteCar(car.id)}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-12 text-center text-gray-400 text-sm">
                  登録車両はありません
                </div>
              )}
            </div>
          </div>
        )}

        {/* アラートタブ */}
        {activeTab === 'alerts' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {unreadCount > 0 && (
                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                  <span className="text-xs text-gray-400">未読 {unreadCount}件</span>
                  <button
                    onClick={handleMarkAllRead}
                    className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    すべて既読にする
                  </button>
                </div>
              )}

              {alerts.length > 0 ? (
                <div className="divide-y divide-gray-50">
                  {alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`p-5 flex items-start gap-4 transition-colors ${alert.status === 'unread' ? 'bg-gray-50/50' : ''}`}
                    >
                      <div className="mt-1">
                        {alert.status === 'unread' ? (
                          <span className="w-2 h-2 bg-gray-900 rounded-full block" />
                        ) : (
                          <span className="w-2 h-2 bg-gray-200 rounded-full block" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-800 text-sm">{alert.title}</span>
                          {alert.status === 'unread' && (
                            <span className="px-1.5 py-0.5 bg-gray-900 text-white text-[10px] rounded font-medium">NEW</span>
                          )}
                        </div>
                        {alert.message && (
                          <p className="text-gray-500 text-sm mt-1">{alert.message}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                          <span className="font-mono">{alert.vehicle.chassisNumber}</span>
                          <span>{new Date(alert.createdAt).toLocaleDateString('ja-JP')}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center text-gray-400 text-sm">
                  通知はありません
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* フッター */}
      <footer className="border-t border-gray-100 mt-16">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 bg-gray-900 rounded flex items-center justify-center">
                  <span className="text-white text-[8px] font-bold">RC</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-gray-400">
                    各メーカー公式サイトおよび国土交通省の情報を元に表示しています
                  </span>
                  <span className="text-xs text-gray-400">
                    出典：国土交通省ウェブサイト（自動車のリコール・不具合情報）
                  </span>
                </div>
              </div>
              <div className="flex gap-6 text-xs text-gray-400">
                <a
                  href="https://renrakuda.mlit.go.jp/renrakuda/announce.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-gray-600 transition-colors inline-flex items-center gap-1"
                >
                  国土交通省
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
            <div className="text-xs text-gray-400 text-center md:text-left">
              このサイトで提供する情報は参考情報です。正確な情報は各メーカーの公式サイトおよび国土交通省のウェブサイトでご確認ください。
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
