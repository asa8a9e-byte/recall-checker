import React, { useState } from 'react';

const RecallCheckerApp = () => {
  const [activeTab, setActiveTab] = useState('check');
  const [chassisNumber, setChassisNumber] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [inventory, setInventory] = useState([
    { id: 1, chassis: 'ZWR80-1234567', maker: 'トヨタ', model: 'ヴォクシー', year: '2019', hasRecall: true, recallCount: 2 },
    { id: 2, chassis: 'DBA-JF3-100', maker: 'ホンダ', model: 'N-BOX', year: '2020', hasRecall: false, recallCount: 0 },
    { id: 3, chassis: 'DAA-ZWR80G', maker: 'トヨタ', model: 'ノア', year: '2018', hasRecall: true, recallCount: 1 },
    { id: 4, chassis: 'E12-1234567', maker: '日産', model: 'ノート', year: '2021', hasRecall: false, recallCount: 0 },
  ]);
  const [newCar, setNewCar] = useState({ chassis: '', maker: '', model: '', year: '' });
  const [alerts, setAlerts] = useState([
    { id: 1, date: '2025/01/15', title: 'トヨタ ヴォクシー リコール発表', chassis: 'ZWR80-1234567', status: 'unread' },
    { id: 2, date: '2025/01/10', title: 'トヨタ ノア リコール発表', chassis: 'DAA-ZWR80G', status: 'read' },
  ]);

  // 単発検索のシミュレーション
  const handleSearch = () => {
    if (!chassisNumber.trim()) return;
    
    setIsSearching(true);
    setSearchResult(null);
    
    // 検索シミュレーション（実際はAPIコール）
    setTimeout(() => {
      const mockResult = {
        chassis: chassisNumber,
        maker: 'トヨタ',
        model: 'プリウス',
        hasRecall: Math.random() > 0.5,
        recalls: [
          {
            id: 'R2024-001',
            title: 'エアバッグインフレータ不具合',
            date: '2024/10/15',
            status: '未対応',
            severity: 'high',
            description: 'エアバッグのインフレータに不具合があり、衝突時に正常に展開しない可能性があります。'
          },
          {
            id: 'R2024-002', 
            title: 'ブレーキブースター不具合',
            date: '2024/08/20',
            status: '対応済',
            severity: 'medium',
            description: 'ブレーキブースターに不具合があり、ブレーキの効きが悪くなる可能性があります。'
          }
        ]
      };
      setSearchResult(mockResult);
      setIsSearching(false);
    }, 1500);
  };

  // 在庫追加
  const handleAddCar = () => {
    if (!newCar.chassis.trim()) return;
    
    const car = {
      id: Date.now(),
      ...newCar,
      hasRecall: false,
      recallCount: 0
    };
    setInventory([...inventory, car]);
    setNewCar({ chassis: '', maker: '', model: '', year: '' });
  };

  // 在庫削除
  const handleDeleteCar = (id) => {
    setInventory(inventory.filter(car => car.id !== id));
  };

  // 一括チェック
  const handleBulkCheck = () => {
    alert('全在庫のリコールチェックを開始します...\n（実装予定）');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-blue-600 text-white shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">🚗 リコールチェッカー</h1>
              <p className="text-blue-100 text-sm">中古車在庫のリコール状況を一括管理</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {alerts.filter(a => a.status === 'unread').length}
                </span>
                <button className="p-2 hover:bg-blue-500 rounded-full">
                  🔔
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* タブナビゲーション */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4">
          <nav className="flex gap-1">
            {[
              { id: 'check', label: '🔍 単発チェック', desc: '車台番号で即検索' },
              { id: 'inventory', label: '📋 在庫管理', desc: '登録車両一覧' },
              { id: 'alerts', label: '🔔 アラート', desc: '新着リコール通知' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-4 font-medium transition-colors relative ${
                  activeTab === tab.id
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
                {tab.id === 'alerts' && alerts.filter(a => a.status === 'unread').length > 0 && (
                  <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
                    {alerts.filter(a => a.status === 'unread').length}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* メインコンテンツ */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        
        {/* 単発チェックタブ */}
        {activeTab === 'check' && (
          <div className="space-y-6">
            {/* 検索フォーム */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4">車台番号でリコール検索</h2>
              <div className="flex gap-4">
                <input
                  type="text"
                  placeholder="車台番号を入力（例：ZWR80-1234567）"
                  value={chassisNumber}
                  onChange={(e) => setChassisNumber(e.target.value.toUpperCase())}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-lg font-mono"
                />
                <button
                  onClick={handleSearch}
                  disabled={isSearching || !chassisNumber.trim()}
                  className="px-8 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {isSearching ? '検索中...' : '検索'}
                </button>
              </div>
              <p className="text-gray-500 text-sm mt-2">
                ※ トヨタ・日産・ホンダ・マツダ・スバル・ダイハツ・三菱・スズキに対応
              </p>
            </div>

            {/* 検索結果 */}
            {searchResult && (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className={`p-4 ${searchResult.hasRecall ? 'bg-red-50 border-l-4 border-red-500' : 'bg-green-50 border-l-4 border-green-500'}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{searchResult.hasRecall ? '⚠️' : '✅'}</span>
                    <div>
                      <h3 className="font-bold text-lg">
                        {searchResult.hasRecall ? 'リコール対象です' : 'リコール対象ではありません'}
                      </h3>
                      <p className="text-gray-600">
                        {searchResult.maker} {searchResult.model} | 車台番号: {searchResult.chassis}
                      </p>
                    </div>
                  </div>
                </div>

                {searchResult.hasRecall && searchResult.recalls.length > 0 && (
                  <div className="p-6">
                    <h4 className="font-bold text-gray-800 mb-4">リコール情報 ({searchResult.recalls.length}件)</h4>
                    <div className="space-y-4">
                      {searchResult.recalls.map((recall, idx) => (
                        <div key={idx} className="border rounded-lg p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                  recall.severity === 'high' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                                }`}>
                                  {recall.severity === 'high' ? '重要' : '注意'}
                                </span>
                                <span className="text-gray-500 text-sm">{recall.date}</span>
                              </div>
                              <h5 className="font-bold text-gray-800">{recall.title}</h5>
                              <p className="text-gray-600 text-sm mt-1">{recall.description}</p>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                              recall.status === '未対応' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                            }`}>
                              {recall.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* アクションボタン */}
                <div className="bg-gray-50 px-6 py-4 flex gap-3">
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    📋 在庫に追加
                  </button>
                  <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors">
                    📄 レポート出力
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 在庫管理タブ */}
        {activeTab === 'inventory' && (
          <div className="space-y-6">
            {/* 在庫追加フォーム */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4">在庫車両を追加</h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <input
                  type="text"
                  placeholder="車台番号"
                  value={newCar.chassis}
                  onChange={(e) => setNewCar({...newCar, chassis: e.target.value.toUpperCase()})}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                />
                <select
                  value={newCar.maker}
                  onChange={(e) => setNewCar({...newCar, maker: e.target.value})}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">メーカー</option>
                  <option value="トヨタ">トヨタ</option>
                  <option value="日産">日産</option>
                  <option value="ホンダ">ホンダ</option>
                  <option value="マツダ">マツダ</option>
                  <option value="スバル">スバル</option>
                  <option value="ダイハツ">ダイハツ</option>
                  <option value="三菱">三菱</option>
                  <option value="スズキ">スズキ</option>
                </select>
                <input
                  type="text"
                  placeholder="車種名"
                  value={newCar.model}
                  onChange={(e) => setNewCar({...newCar, model: e.target.value})}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <input
                  type="text"
                  placeholder="年式"
                  value={newCar.year}
                  onChange={(e) => setNewCar({...newCar, year: e.target.value})}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <button
                  onClick={handleAddCar}
                  disabled={!newCar.chassis.trim()}
                  className="px-4 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  ＋ 追加
                </button>
              </div>
              <div className="mt-4 flex gap-4">
                <button className="text-blue-600 hover:underline text-sm">
                  📁 CSVインポート
                </button>
                <button className="text-blue-600 hover:underline text-sm">
                  📊 Googleスプレッドシート連携
                </button>
              </div>
            </div>

            {/* 在庫一覧 */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 border-b flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-800">
                  在庫一覧 ({inventory.length}台)
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={handleBulkCheck}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-bold"
                  >
                    🔄 全件リコールチェック
                  </button>
                  <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors text-sm">
                    📥 CSVエクスポート
                  </button>
                </div>
              </div>

              {/* サマリー */}
              <div className="grid grid-cols-3 border-b">
                <div className="p-4 text-center border-r">
                  <div className="text-3xl font-bold text-gray-800">{inventory.length}</div>
                  <div className="text-gray-500 text-sm">総在庫</div>
                </div>
                <div className="p-4 text-center border-r">
                  <div className="text-3xl font-bold text-red-600">
                    {inventory.filter(c => c.hasRecall).length}
                  </div>
                  <div className="text-gray-500 text-sm">リコール対象</div>
                </div>
                <div className="p-4 text-center">
                  <div className="text-3xl font-bold text-green-600">
                    {inventory.filter(c => !c.hasRecall).length}
                  </div>
                  <div className="text-gray-500 text-sm">問題なし</div>
                </div>
              </div>

              {/* テーブル */}
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-600">車台番号</th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-600">メーカー</th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-600">車種</th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-600">年式</th>
                    <th className="px-4 py-3 text-center text-sm font-bold text-gray-600">リコール</th>
                    <th className="px-4 py-3 text-center text-sm font-bold text-gray-600">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.map((car) => (
                    <tr key={car.id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-sm">{car.chassis}</td>
                      <td className="px-4 py-3">{car.maker}</td>
                      <td className="px-4 py-3">{car.model}</td>
                      <td className="px-4 py-3">{car.year}</td>
                      <td className="px-4 py-3 text-center">
                        {car.hasRecall ? (
                          <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-bold">
                            {car.recallCount}件
                          </span>
                        ) : (
                          <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-bold">
                            なし
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button className="text-blue-600 hover:underline text-sm mr-3">詳細</button>
                        <button 
                          onClick={() => handleDeleteCar(car.id)}
                          className="text-red-600 hover:underline text-sm"
                        >
                          削除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* アラートタブ */}
        {activeTab === 'alerts' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 border-b flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-800">新着リコールアラート</h2>
                <button className="text-blue-600 hover:underline text-sm">すべて既読にする</button>
              </div>
              
              <div className="divide-y">
                {alerts.map((alert) => (
                  <div 
                    key={alert.id}
                    className={`p-4 flex items-start gap-4 ${alert.status === 'unread' ? 'bg-blue-50' : ''}`}
                  >
                    <div className="text-2xl">
                      {alert.status === 'unread' ? '🔴' : '⚪'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-800">{alert.title}</span>
                        {alert.status === 'unread' && (
                          <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">NEW</span>
                        )}
                      </div>
                      <p className="text-gray-500 text-sm mt-1">
                        対象車両: {alert.chassis}
                      </p>
                      <p className="text-gray-400 text-xs mt-1">{alert.date}</p>
                    </div>
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm">
                      詳細を見る
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* 通知設定 */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4">🔔 通知設定</h2>
              <div className="space-y-4">
                <label className="flex items-center gap-3">
                  <input type="checkbox" defaultChecked className="w-5 h-5 rounded" />
                  <span>新リコール発表時にメール通知</span>
                </label>
                <label className="flex items-center gap-3">
                  <input type="checkbox" defaultChecked className="w-5 h-5 rounded" />
                  <span>ブラウザプッシュ通知</span>
                </label>
                <label className="flex items-center gap-3 opacity-50">
                  <input type="checkbox" disabled className="w-5 h-5 rounded" />
                  <span>LINE通知（近日対応予定）</span>
                </label>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* フッター */}
      <footer className="bg-gray-800 text-gray-400 mt-12">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm">© 2025 リコールチェッカー</p>
              <p className="text-xs mt-1">※ 本サービスは各メーカー公式情報を元に提供しています</p>
            </div>
            <div className="flex gap-4 text-sm">
              <a href="#" className="hover:text-white">利用規約</a>
              <a href="#" className="hover:text-white">プライバシーポリシー</a>
              <a href="#" className="hover:text-white">お問い合わせ</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default RecallCheckerApp;
