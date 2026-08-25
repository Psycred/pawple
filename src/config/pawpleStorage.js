import AsyncStorage from '@react-native-async-storage/async-storage';

const LIKED_POSTS_KEY = '@pawple:likedPosts';
const ACTIVE_PET_KEY = '@pawple:activePet';

export const pawpleStorage = {
  // Liked posts
  async getLikedPosts() {
    try {
      const data = await AsyncStorage.getItem(LIKED_POSTS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error loading liked posts:', error);
      return [];
    }
  },

  async toggleLikePost(postId) {
    try {
      const liked = await this.getLikedPosts();
      const isLiked = liked.includes(postId);
      const updated = isLiked 
        ? liked.filter(id => id !== postId)
        : [...liked, postId];
      await AsyncStorage.setItem(LIKED_POSTS_KEY, JSON.stringify(updated));
      return !isLiked;
    } catch (error) {
      console.error('Error toggling like:', error);
      return false;
    }
  },

  // Active pet
  async getActivePet() {
    try {
      return await AsyncStorage.getItem(ACTIVE_PET_KEY);
    } catch (error) {
      console.error('Error loading active pet:', error);
      return null;
    }
  },

  async setActivePet(petId) {
    try {
      await AsyncStorage.setItem(ACTIVE_PET_KEY, petId);
      return true;
    } catch (error) {
      console.error('Error setting active pet:', error);
      return false;
    }
  },
};
