// src/screens/Main/WalletScreen.js
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Modal, SafeAreaView, Platform, Alert } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import Clipboard from '@react-native-clipboard/clipboard';
import { fetchWalletData } from '../../store/walletSlice';
import { getDepositAddress } from '../../api/apiService';
import { colors } from '../../theme/colors';
import Button from '../../components/common/Button';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

const DepositModal = ({ visible, onClose, asset }) => {
  const [depositInfo, setDepositInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (asset) {
      setLoading(true);
      getDepositAddress(asset)
        .then(response => setDepositInfo(response.data))
        .catch(err => console.error("Deposit Address Error:", err))
        .finally(() => setLoading(false));
    }
  }, [asset]);

  const copyToClipboard = (text) => {
    Clipboard.setString(text);
    Alert.alert("Copied!", "Address copied to clipboard.");
  };

  return (
    <Modal visible={visible} transparent={true} animationType="fade">
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}><Ionicons name="close-circle" size={30} color={colors.dark.muted} /></TouchableOpacity>
          <Text style={styles.modalTitle}>Deposit {asset}</Text>
          {loading ? <ActivityIndicator size="large" color={colors.accent} /> :
            depositInfo ? (
              <>
                <View style={styles.qrCodeContainer}>
                  <QRCode value={depositInfo.address} size={200} backgroundColor={colors.dark.text} color={colors.dark.primary}/>
                </View>
                <Text style={styles.addressText}>{depositInfo.address}</Text>
                <Button title="Copy Address" onPress={() => copyToClipboard(depositInfo.address)} />
                <Text style={styles.warningText}>Only send {asset} to this address.</Text>
              </>
            ) : <Text style={styles.errorText}>Could not load deposit address.</Text>
          }
        </View>
      </View>
    </Modal>
  );
};

const WalletScreen = () => {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const { balances, transactions, status } = useSelector((state) => state.wallet);
  const [isModalVisible, setModalVisible] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      dispatch(fetchWalletData());
    });
    return unsubscribe;
  }, [navigation, dispatch]);

  const handleDeposit = (asset) => {
    setSelectedAsset(asset);
    setModalVisible(true);
  };

  if (status === 'loading' && balances.length === 0) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={colors.accent} /></View>;
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={balances}
        keyExtractor={(item) => item.asset}
        ListHeaderComponent={
          <>
            <Text style={styles.headerTitle}>Your Balances</Text>
            {balances.length === 0 && <Text style={styles.emptyText}>No balances found.</Text>}
          </>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.assetTitle}>{item.asset}</Text>
            <Text style={styles.assetBalance}>{parseFloat(item.balance).toFixed(8)}</Text>
            <View style={styles.actionsRow}>
              <Button title="Deposit" onPress={() => handleDeposit(item.asset)} style={{flex: 1}}/>
              <Button title="Withdraw" onPress={() => {}} disabled style={{flex: 1, marginLeft: 10, backgroundColor: colors.dark.border}}/>
            </View>
          </View>
        )}
        ListFooterComponent={
          <>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            {transactions.length === 0 && <Text style={styles.emptyText}>No transactions yet.</Text>}
            {transactions.map(tx => (
              <View key={tx.id} style={styles.txRow}>
                <View>
                  <Text style={styles.txType}>{tx.type.replace('_', ' ')} - {tx.asset}</Text>
                  <Text style={styles.txDate}>{new Date(tx.created_at).toLocaleString()}</Text>
                </View>
                <Text style={styles.txAmount(tx.amount)}>{parseFloat(tx.amount) > 0 ? '+' : ''}{parseFloat(tx.amount).toFixed(6)}</Text>
              </View>
            ))}
          </>
        }
      />
      <DepositModal visible={isModalVisible} onClose={() => setModalVisible(false)} asset={selectedAsset} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.dark.primary },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.dark.primary },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: colors.dark.text, padding: 15 },
  sectionTitle: { fontSize: 22, fontWeight: 'bold', color: colors.dark.text, paddingHorizontal: 15, marginTop: 20, marginBottom: 10 },
  card: { backgroundColor: colors.dark.secondary, padding: 20, borderRadius: 10, marginHorizontal: 15, marginBottom: 15 },
  assetTitle: { fontSize: 20, fontWeight: 'bold', color: colors.dark.text },
  assetBalance: { fontSize: 18, color: colors.accent, fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', marginVertical: 10 },
  actionsRow: { flexDirection: 'row', marginTop: 10 },
  emptyText: { color: colors.dark.muted, textAlign: 'center', padding: 20 },
  txRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 15, paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: colors.dark.border },
  txType: { color: colors.dark.text, fontWeight: '600' },
  txDate: { color: colors.dark.muted, fontSize: 12, marginTop: 4 },
  txAmount: amount => ({ color: parseFloat(amount) > 0 ? colors.success : colors.danger, fontWeight: 'bold', fontSize: 16 }),
  modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.8)' },
  modalContent: { backgroundColor: colors.dark.secondary, padding: 20, borderRadius: 10, alignItems: 'center', width: '90%' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: colors.dark.text, marginBottom: 20 },
  closeButton: { position: 'absolute', top: 10, right: 10 },
  qrCodeContainer: { backgroundColor: 'white', padding: 10, borderRadius: 5 },
  addressText: { color: colors.dark.text, marginVertical: 20, textAlign: 'center', fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace' },
  warningText: { color: colors.dark.muted, fontSize: 12, textAlign: 'center', marginTop: 15 },
  errorText: { color: colors.danger },
});

export default WalletScreen;