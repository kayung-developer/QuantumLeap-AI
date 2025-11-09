// src/components/dashboard/CreateBotModal.js
import React, { useState } from 'react';
import { View, Text, Modal, StyleSheet, ScrollView } from 'react-native';
import { useSelector } from 'react-redux';
import { colors } from '../../theme/colors';
import Input from '../common/Input';
import Button from '../common/Button';

// Simplified for mobile - we will only allow creating a simple MA_Cross bot
const CreateBotModal = ({ visible, onClose, onSubmit }) => {
  const { mutationStatus, error } = useSelector((state) => state.bots);
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('BTC/USDT');

  const handleSubmit = () => {
    const botData = {
      name,
      symbol,
      exchange: 'binance', // Hardcoded for simplicity
      strategy_name: 'MA_Cross',
      strategy_params: { short_window: 50, long_window: 200 },
      is_paper_trading: true,
    };
    onSubmit(botData);
  };

  return (
    <Modal visible={visible} transparent={true} animationType="slide">
      <View style={styles.modalContainer}>
        <ScrollView style={styles.modalContent}>
          <Text style={styles.modalTitle}>Create MA Cross Bot</Text>
          <Input label="Bot Name" value={name} onChangeText={setName} />
          <Input label="Symbol" value={symbol} onChangeText={setSymbol} />
          {error && mutationStatus === 'failed' && <Text style={styles.errorText}>{error}</Text>}
          <Button title="Create Bot" onPress={handleSubmit} isLoading={mutationStatus === 'loading'} />
          <Button title="Cancel" onPress={onClose} style={{backgroundColor: colors.dark.border, marginTop: 10}} />
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
    modalContainer: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' },
    modalContent: { backgroundColor: colors.dark.secondary, padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' },
    modalTitle: { fontSize: 22, fontWeight: 'bold', color: colors.dark.text, marginBottom: 20, textAlign: 'center' },
    errorText: { color: colors.danger, textAlign: 'center', marginBottom: 10 },
});

export default CreateBotModal;