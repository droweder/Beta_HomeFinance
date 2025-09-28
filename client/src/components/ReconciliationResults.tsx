import React, { useMemo, useState } from 'react';
import { X, AlertTriangle, CheckCircle, PlusCircle, Trash2, Banknote, FileWarning, FileCheck, Calendar, Wallet } from 'lucide-react';
import type { CreditCard } from '../types/index';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface StatementTransaction {
  date: string;
  description: string;
  amount: number;
  raw: string;
}

interface ReconciliationResultsProps {
  isOpen: boolean;
  onClose: () => void;
  creditCards: CreditCard[];
  reconMonth: string;
  reconAccount: string;
  parsedTransactions: StatementTransaction[];
  onAddExpense: (expense: Partial<CreditCard>) => void;
  onDeleteExpense?: (expenseId: string) => void;
}

const ReconciliationResults: React.FC<ReconciliationResultsProps> = ({
  isOpen,
  onClose,
  creditCards,
  reconMonth,
  reconAccount,
  parsedTransactions,
  onAddExpense,
  onDeleteExpense,
}) => {
  const { matched, missingInApp, missingInStatement } = useMemo(() => {
    if (!isOpen) return { matched: [], missingInApp: [], missingInStatement: [] };

    const appTransactions = creditCards.filter(card => {
      const cardMonth = card.date.substring(0, 7);
      return cardMonth === reconMonth && card.paymentMethod === reconAccount;
    });

    const matchedPairs: { statement: StatementTransaction; app: CreditCard }[] = [];
    const notFoundInApp: StatementTransaction[] = [];
    const notFoundInStatement = [...appTransactions];

    for (const st of parsedTransactions) {
      const appExpenseIndex = notFoundInStatement.findIndex(ae => {
        const statementAmount = Math.abs(st.amount);
        const appAmount = Math.abs(ae.amount);
        return Math.abs(statementAmount - appAmount) < 0.01;
      });

      if (appExpenseIndex !== -1) {
        const [appExpense] = notFoundInStatement.splice(appExpenseIndex, 1);
        matchedPairs.push({ statement: st, app: appExpense });
      } else {
        notFoundInApp.push(st);
      }
    }

    return { matched: matchedPairs, missingInApp: notFoundInApp, missingInStatement: notFoundInStatement };
  }, [isOpen, parsedTransactions, creditCards, reconMonth, reconAccount]);

  const handleAddClick = (transaction: StatementTransaction) => {
    const [day, month, year] = transaction.date.split('/');
    const formattedDate = `${year}-${month}-${day}`;

    onAddExpense({
      date: formattedDate,
      description: transaction.description,
      amount: transaction.amount,
      paymentMethod: reconAccount,
      category: 'Cartão de Crédito',
    });
  };

  if (!isOpen) {
    return null;
  }

  const formattedReconMonth = useMemo(() => {
    if (!reconMonth) return '';
    const [year, month] = reconMonth.split('-');
    return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('pt-BR', {
      month: 'long',
      year: 'numeric',
    });
  }, [reconMonth]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Resultado da Conciliação</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Summary Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Wallet className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <div>
                <div className="text-blue-600 dark:text-blue-400 text-sm font-medium">Conta</div>
                <div className="text-blue-700 dark:text-blue-300 text-lg font-bold">{reconAccount}</div>
              </div>
            </div>
          </div>
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <FileWarning className="w-6 h-6 text-red-600 dark:text-red-400" />
              <div>
                <div className="text-red-600 dark:text-red-400 text-sm font-medium">Na Fatura, não no App</div>
                <div className="text-red-700 dark:text-red-300 text-lg font-bold">{missingInApp.length}</div>
              </div>
            </div>
          </div>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <FileCheck className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              <div>
                <div className="text-yellow-600 dark:text-yellow-400 text-sm font-medium">No App, não na Fatura</div>
                <div className="text-yellow-700 dark:text-yellow-300 text-lg font-bold">{missingInStatement.length}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tables Container */}
        <div className="flex-grow overflow-y-auto space-y-6">
          {missingInApp.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
                Lançamentos na Fatura, mas não no App
              </h3>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg overflow-hidden">
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full">
                    <thead className="bg-gray-100 dark:bg-gray-600 sticky top-0">
                      <tr>
                        <th className="text-left py-2 px-4 font-medium text-gray-900 dark:text-white">Data</th>
                        <th className="text-left py-2 px-4 font-medium text-gray-900 dark:text-white">Descrição</th>
                        <th className="text-right py-2 px-4 font-medium text-gray-900 dark:text-white">Valor</th>
                        <th className="text-center py-2 px-4 font-medium text-gray-900 dark:text-white">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {missingInApp.map((t, i) => (
                        <tr key={`missing-app-${i}`} className="border-b border-gray-200 dark:border-gray-600 hover:bg-white dark:hover:bg-gray-600">
                          <td className="py-2 px-4 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">{t.date}</td>
                          <td className="py-2 px-4 text-sm text-gray-700 dark:text-gray-300">{t.description}</td>
                          <td className="py-2 px-4 text-sm text-right font-mono text-red-600 dark:text-red-400 whitespace-nowrap">
                            {t.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </td>
                          <td className="py-2 px-4 text-center">
                            <button onClick={() => handleAddClick(t)} className="text-blue-500 hover:text-blue-700 p-1">
                              <PlusCircle className="w-5 h-5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {missingInStatement.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
                Lançamentos no App, mas não na Fatura
              </h3>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg overflow-hidden">
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full">
                    <thead className="bg-gray-100 dark:bg-gray-600 sticky top-0">
                      <tr>
                        <th className="text-left py-2 px-4 font-medium text-gray-900 dark:text-white">Data</th>
                        <th className="text-left py-2 px-4 font-medium text-gray-900 dark:text-white">Descrição</th>
                        <th className="text-right py-2 px-4 font-medium text-gray-900 dark:text-white">Valor</th>
                        <th className="text-center py-2 px-4 font-medium text-gray-900 dark:text-white">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {missingInStatement.map((e, i) => (
                        <tr key={`missing-stmt-${i}`} className="border-b border-gray-200 dark:border-gray-600 hover:bg-white dark:hover:bg-gray-600">
                          <td className="py-2 px-4 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">{format(new Date(e.date), 'dd/MM/yyyy', { locale: ptBR })}</td>
                          <td className="py-2 px-4 text-sm text-gray-700 dark:text-gray-300">{e.description}</td>
                          <td className="py-2 px-4 text-sm text-right font-mono text-yellow-600 dark:text-yellow-400 whitespace-nowrap">
                            {e.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </td>
                          <td className="py-2 px-4 text-center">
                            {onDeleteExpense && (
                              <button onClick={() => onDeleteExpense(e.id)} className="text-red-500 hover:text-red-700 p-1">
                                <Trash2 className="w-5 h-5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {missingInApp.length === 0 && missingInStatement.length === 0 && (
            <div className="text-center py-12 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Tudo conciliado!</h3>
              <p className="text-gray-600 dark:text-gray-400 mt-2">Nenhuma divergência encontrada para {reconAccount} em {formattedReconMonth}.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 flex justify-end pt-6 mt-auto">
          <button onClick={onClose} className="bg-gray-200 text-gray-800 px-6 py-2 rounded-lg hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 transition-colors">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReconciliationResults;