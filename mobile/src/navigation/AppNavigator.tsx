import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import TabNavigator from './TabNavigator';
import ProjectDetailScreen from '../screens/Projects/ProjectDetail';
import ExperimentDetailScreen from '../screens/Experiments/ExperimentDetail';
import ResourceDetailScreen from '../screens/Resources/ResourceDetail';
import FindingDetailScreen from '../screens/Findings/FindingDetail';

const Stack = createStackNavigator();

export default function AppNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#242424',
        },
        headerTintColor: '#e0e0e0',
        headerTitleStyle: {
          fontWeight: '600',
        },
      }}
    >
      <Stack.Screen
        name="MainTabs"
        component={TabNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ProjectDetail"
        component={ProjectDetailScreen}
        options={{ title: 'Project Details' }}
      />
      <Stack.Screen
        name="ExperimentDetail"
        component={ExperimentDetailScreen}
        options={{ title: 'Experiment Details' }}
      />
      <Stack.Screen
        name="ResourceDetail"
        component={ResourceDetailScreen}
        options={{ title: 'Resource Details' }}
      />
      <Stack.Screen
        name="FindingDetail"
        component={FindingDetailScreen}
        options={{ title: 'Finding Details' }}
      />
    </Stack.Navigator>
  );
}
