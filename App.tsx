import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet, ScrollView, Image } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import AsyncStorage from '@react-native-async-storage/async-storage';


WebBrowser.maybeCompleteAuthSession();

export default function App() {
  const [userInfo, setUserInfo] = useState(null);
  const [stepsInfo, setStepsInfo] = useState(null);
  const [caloriesData, setCaloriesData] = useState(null);

  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: '313096575974-mvosd2suuv4hm19m0vr3h8ls5okgpu38.apps.googleusercontent.com',
    webClientId: '313096575974-4humhg40nd34rbe4i328el5mbpthviju.apps.googleusercontent.com',
    redirectUri: AuthSession.makeRedirectUri({ scheme: 'com.afonsomota23feup.GoogleFitApp' }),

    scopes: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/fitness.activity.read',
      'https://www.googleapis.com/auth/fitness.nutrition.read',
    ],
  });

  useEffect(() => {
    handleSignInWithGoogle();
  }, [response]);

  async function getUserInfoAndFitnessData(token) {
    if (!token) return;

    try {
      // Info do utilizador
      const userResponse = await fetch("https://www.googleapis.com/userinfo/v2/me", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const user = await userResponse.json();
      await AsyncStorage.setItem("@user", JSON.stringify(user));
      setUserInfo(user);

      const now = new Date();
      const endTimeMillis = now.getTime();
      const startOfDay = new Date(now.setHours(0, 0, 0, 0)).getTime();

      // Passos
      const stepsResponse = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          aggregateBy: [{
            dataTypeName: "com.google.step_count.delta",
            dataSourceId: "derived:com.google.step_count.delta:com.google.android.gms:estimated_steps"
          }],
          bucketByTime: { durationMillis: 86400000 },
          startTimeMillis: startOfDay,
          endTimeMillis,
        }),
      });

      const steps = await stepsResponse.json();
      const bucket = steps.bucket?.[0];
      const point = bucket?.dataset?.[0]?.point || [];

      const totalSteps = point.reduce((sum, p) => sum + (p.value?.[0]?.intVal || 0), 0);

      setStepsInfo({
        totalSteps,
        start: new Date(parseInt(bucket?.startTimeMillis)).toLocaleString(),
        end: new Date(parseInt(bucket?.endTimeMillis)).toLocaleString(),
      });

      // Calorias
      const caloriesResponse = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          aggregateBy: [{
            dataTypeName: "com.google.calories.expended",
            dataSourceId: "derived:com.google.calories.expended:com.google.android.gms:merge_calories_expended"
          }],
          bucketByTime: { durationMillis: 86400000 },
          startTimeMillis: startOfDay,
          endTimeMillis,
        }),
      });

      const calories = await caloriesResponse.json();
      const caloriePoints = calories.bucket?.[0]?.dataset?.[0]?.point || [];
      const totalCalories = caloriePoints.reduce((sum, point) => sum + (point.value?.[0]?.fpVal || 0), 0);
      setCaloriesData(totalCalories);
    } catch (error) {
      console.log('Erro ao buscar dados:', error);
    }
  }

  async function handleSignInWithGoogle() {
    const user = await AsyncStorage.getItem("@user");

    if (!user) {
      if (response?.type === "success") {
        await getUserInfoAndFitnessData(response.authentication.accessToken);
      }
    } else {
      setUserInfo(JSON.parse(user));
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>Google Fit Dashboard</Text>

      {userInfo && (
        <View style={styles.card}>
          {userInfo.picture && (
            <Image source={{ uri: userInfo.picture }} style={styles.avatar} />
          )}
          <Text style={styles.title}>{userInfo.name}</Text>
          <Text>{userInfo.email}</Text>
        </View>
      )}

      {stepsInfo && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>👣 Passos</Text>
          <Text>Total: {stepsInfo.totalSteps}</Text>
          <Text>De: {stepsInfo.start}</Text>
          <Text>Até: {stepsInfo.end}</Text>
        </View>
      )}

      {caloriesData !== null && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>🔥 Calorias gastas</Text>
          <Text>{caloriesData.toFixed(2)} kcal</Text>
        </View>
      )}

      <View style={styles.buttons}>
        <Button title="Sign in with Google" onPress={() => promptAsync()} />
        <View style={{ height: 10 }} />
        <Button title="Apagar dados locais" onPress={() => {
          AsyncStorage.removeItem("@user");
          setUserInfo(null);
          setStepsInfo(null);
          setCaloriesData(null);
        }} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingTop: 40,
    alignItems: 'center',
  },
  header: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  card: {
    width: '90%',
    backgroundColor: '#f1f1f1',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  buttons: {
    width: '90%',
    marginTop: 20,
  },
});
