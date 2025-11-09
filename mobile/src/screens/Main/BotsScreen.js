// src/screens/Main/BotsScreen.js
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import { fetchBots, createBotAsync } from '../../store/botsSlice'; // Import createBotAsync
import { colors } from '../../theme/colors';
import BotCard from '../../components/dashboard/BotCard';
import Button from '../../components/common/Button';
import CreateBotModal from '../../components/dashboard/CreateBotModal'; // We'll create this next

const BotsScreen = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { bots, status: botsStatus, error } = useSelector((state) => state.bots);
  const [isCreateModalVisible, setCreateModalVisible] = useState(false);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      dispatch(fetchBots());
    });
    return unsubscribe;
  }, [navigation, dispatch]);

  const handleCreateBot = (botData) => {
    dispatch(createBotAsync(botData)).then((result) => {
      if (result.meta.requestStatus === 'fulfilled') {
        setCreateModalVisible(false);
      }
    });
  };

  return (
  <View style={styles.container}>
    <FlatList
      style={styles.container}
      data={bots}
      renderItem={({ item }) => (
      <TouchableOpacity onPress={() => navigation.navigate('BotDetail', { botId: item.id, botName: item.name })}>

      <BotCard bot={item} />
       </TouchableOpacity>
      keyExtractor={(item) => item.id}
      ListEmptyComponent={ <Button title="Create New Bot" onPress={() => setCreateModalVisible(true)} />}
        <View style={styles.centered}>
          <Text style={styles.emptyText}>You haven't created any bots yet.</Text>
        </View>
      }
    <CreateBotModal
        visible={isCreateModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onSubmit={handleCreateBot}/>
        );
   </View>
 );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.dark.primary, padding: 15 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.dark.primary },
  emptyText: { color: colors.dark.muted, fontSize: 16 },
  errorText: { color: colors.danger, fontSize: 16 },
});

export default BotsScreen;