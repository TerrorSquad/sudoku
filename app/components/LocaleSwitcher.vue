<script setup lang="ts">
const { locale, locales, setLocale } = useI18n();

const items = computed(() =>
  locales.value.map((l) => ({ label: l.name ?? l.code, value: l.code })),
);

const selected = computed({
  get: () => locale.value,
  set: (val) => setLocale(val),
});
</script>

<template>
  <USelectMenu
    v-model="selected"
    :items="items"
    value-key="value"
    :aria-label="$t('a11y.switchLanguage')"
    class="w-28"
  />
</template>
