import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { authApi, organizationApi, setAccessToken, type Organization, type User } from '../services/api'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const organizations = ref<Organization[]>([])
  const activeOrganizationId = ref('')
  const ready = ref(false)
  const busy = ref(false)
  const error = ref('')
  const activeOrganization = computed(() => organizations.value.find((item) => item.id === activeOrganizationId.value) ?? null)

  // Refresh the signed-in profile and organization list, retaining the active tenant when it still exists.
  async function loadProfile() {
    const [profile, list] = await Promise.all([authApi.me(), organizationApi.list()])
    user.value = profile.user
    organizations.value = list.length ? list : profile.organizations
    if (!organizations.value.some((item) => item.id === activeOrganizationId.value)) {
      activeOrganizationId.value = organizations.value[0]?.id ?? ''
    }
  }
  async function signIn(email: string, password: string) {
    busy.value = true; error.value = ''
    try {
      const result = await authApi.login({ email, password })
      setAccessToken(result.accessToken)
      await loadProfile()
    } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Unable to sign in.'; throw cause }
    finally { busy.value = false }
  }
  async function signUp(input: { name: string; email: string; password: string; organizationName: string }) {
    busy.value = true; error.value = ''
    try {
      const result = await authApi.register(input)
      setAccessToken(result.accessToken)
      await loadProfile()
    } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Unable to create account.'; throw cause }
    finally { busy.value = false }
  }
  async function restore() {
    try {
      const token = await authApi.refresh()
      if (token) await loadProfile()
    } catch { setAccessToken(null); user.value = null }
    finally { ready.value = true }
  }
  async function signOut() {
    try { await authApi.logout() } finally {
      setAccessToken(null); user.value = null; organizations.value = []; activeOrganizationId.value = ''
    }
  }
  return { user, organizations, activeOrganizationId, activeOrganization, ready, busy, error, signIn, signUp, restore, signOut }
})
